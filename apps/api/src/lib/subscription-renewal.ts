import { BillingCycle } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from './response';

export function addBillingCycle(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from);
  if (cycle === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function generateInvoiceNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

export function isFreePlan(plan: { code?: string | null; tier?: string | null; monthlyPrice?: number | null; price?: number | null }): boolean {
  const code = (plan.code || '').toLowerCase();
  if (code === 'free') return true;
  const monthly = plan.monthlyPrice ?? plan.price ?? 0;
  return plan.tier === 'FREE' && monthly <= 0;
}

export function renewalAmountFor(
  plan: { code?: string | null; tier?: string | null; monthlyPrice?: number | null; yearlyPrice?: number | null; price?: number | null },
  cycle: BillingCycle,
  subscriptionPrice?: number | null,
): number {
  let amount: number;
  if (cycle === 'YEARLY') {
    amount = plan.yearlyPrice ?? (plan.monthlyPrice ?? plan.price ?? 0) * 12;
  } else {
    amount = plan.monthlyPrice ?? plan.price ?? 0;
  }

  // Fall back to the price stored on the subscription record.
  if (amount <= 0 && subscriptionPrice && subscriptionPrice > 0) {
    return cycle === 'YEARLY' ? subscriptionPrice * 12 : subscriptionPrice;
  }

  // Enterprise / custom tiers without explicit pricing use platform defaults.
  if (amount <= 0 && plan.tier === 'ENTERPRISE') {
    return cycle === 'YEARLY' ? 99990 : 9999;
  }

  return amount;
}

export function requiresCustomQuote(
  plan: { code?: string | null; tier?: string | null; monthlyPrice?: number | null; price?: number | null },
  amount: number,
): boolean {
  if (isFreePlan(plan)) return false;
  if (amount > 0) return false;
  return plan.tier === 'ENTERPRISE' || (plan.code || '').toLowerCase() === 'enterprise';
}

// Applies a successful renewal payment to its subscription. Idempotent: a
// payment already marked COMPLETED is returned unchanged (safe for webhook
// retries). Extends the subscription from the later of (now, current endDate),
// records history, generates an invoice number and notifies org admins.
export async function applySubscriptionRenewal(
  paymentId: string,
  opts: { gatewayPaymentId?: string; method?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!payment) throw new AppError('Renewal payment not found', 404);
    if (payment.status === 'COMPLETED') return payment;

    const sub = payment.subscription;
    const base = sub.endDate && sub.endDate > new Date() ? sub.endDate : new Date();
    const newEnd = addBillingCycle(base, payment.billingCycle);
    const invoiceNumber = payment.invoiceNumber || generateInvoiceNumber();

    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        endDate: newEnd,
        billingCycle: payment.billingCycle,
        planId: payment.planId || sub.planId,
        price: payment.amount,
        changeSource: 'PAYMENT',
        suspendReason: null,
      },
    });

    const updatedPayment = await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED', paidAt: new Date(), periodStart: base, periodEnd: newEnd,
        invoiceNumber, gatewayPaymentId: opts.gatewayPaymentId, method: opts.method,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id, organizationId: sub.organizationId,
        previousPlanId: sub.planId, newPlanId: sub.planId,
        previousStatus: sub.status, newStatus: 'ACTIVE',
        newPrice: payment.amount, reason: `Renewal payment · invoice ${invoiceNumber}`, changeSource: 'PAYMENT',
      },
    });

    const admins = await tx.staff.findMany({
      where: { organizationId: sub.organizationId, role: { in: ['HOSPITAL_ADMIN', 'BRANCH_ADMIN'] } },
      select: { userId: true },
    });
    for (const a of admins) {
      await tx.notification.create({
        data: {
          userId: a.userId, type: 'SUBSCRIPTION', title: 'Subscription renewed',
          message: `Your ${sub.plan.name} plan is renewed until ${newEnd.toDateString()}. Invoice ${invoiceNumber}.`,
          data: { subscriptionId: sub.id, invoiceNumber, endDate: newEnd.toISOString(), amount: payment.amount },
        },
      });
    }

    return updatedPayment;
  });
}
