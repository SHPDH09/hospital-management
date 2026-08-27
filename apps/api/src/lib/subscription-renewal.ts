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

export function renewalAmountFor(plan: { monthlyPrice?: number | null; yearlyPrice?: number | null; price?: number | null }, cycle: BillingCycle): number {
  if (cycle === 'YEARLY') return plan.yearlyPrice ?? (plan.monthlyPrice ?? plan.price ?? 0) * 12;
  return plan.monthlyPrice ?? plan.price ?? 0;
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
