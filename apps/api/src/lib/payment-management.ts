import { OrganizationType, PaymentPurpose, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface PaymentListFilters {
  search?: string;
  status?: string;
  purpose?: string;
  method?: string;
  gateway?: string;
  organizationId?: string;
  organizationType?: OrganizationType;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function generatePaymentNumber(): Promise<string> {
  const latest = await prisma.payment.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { paymentNumber: true },
  });
  const lastNum = latest?.paymentNumber
    ? parseInt(latest.paymentNumber.replace(/\D/g, ''), 10) || 0
    : 0;
  return `PAY-${String(lastNum + 1).padStart(5, '0')}`;
}

export async function getPaymentManagementDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const successStatuses: PaymentStatus[] = ['CAPTURED', 'COMPLETED'];
  const pendingStatuses: PaymentStatus[] = ['INITIATED', 'PROCESSING', 'AUTHORIZED', 'PENDING'];
  const refundStatuses: PaymentStatus[] = ['REFUNDED', 'PARTIAL_REFUND'];

  const [
    totalRevenue,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    pendingAmount,
    successfulPayments,
    failedPayments,
    refundedAmount,
    partialRefunds,
    disputedPayments,
    platformCommission,
    referralCommission,
    subscriptionRevenue,
    adRevenue,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { status: { in: successStatuses } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: { in: successStatuses }, createdAt: { gte: today } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: { in: successStatuses }, createdAt: { gte: weekStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: { in: successStatuses }, createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: { in: pendingStatuses } }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: { in: successStatuses } } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.aggregate({ where: { status: 'REFUNDED' }, _sum: { refundAmount: true, amount: true } }),
    prisma.payment.count({ where: { status: 'PARTIAL_REFUND' } }),
    prisma.payment.count({ where: { status: 'DISPUTED' } }),
    prisma.payment.aggregate({ where: { status: { in: successStatuses } }, _sum: { platformFee: true } }),
    prisma.payment.count({ where: { purpose: 'REFERRAL_COMMISSION', status: { in: successStatuses } } }),
    prisma.subscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } }),
    prisma.advertisement.aggregate({ _sum: { budget: true } }),
  ]);

  const subscriptionTotal = subscriptionRevenue.reduce((s, sub) => s + (sub.plan.price || sub.plan.monthlyPrice || 0), 0);
  const providerRevenue = (totalRevenue._sum.amount || 0) - (platformCommission._sum.platformFee || 0);
  const netRevenue = (totalRevenue._sum.amount || 0) - (refundedAmount._sum.refundAmount || refundedAmount._sum.amount || 0);

  const hospitalRevenue = await aggregateProviderRevenue('HOSPITAL', successStatuses);
  const clinicRevenue = await aggregateProviderRevenue('CLINIC', successStatuses);

  const exceptions = await detectPaymentExceptions();

  return {
    totalRevenue: totalRevenue._sum.amount || 0,
    netRevenue,
    todayRevenue: todayRevenue._sum.amount || 0,
    weekRevenue: weekRevenue._sum.amount || 0,
    monthRevenue: monthRevenue._sum.amount || 0,
    grossRevenue: totalRevenue._sum.amount || 0,
    platformRevenue: platformCommission._sum.platformFee || 0,
    providerRevenue,
    pendingAmount: pendingAmount._sum.amount || 0,
    successfulPayments,
    failedPayments,
    refundedAmount: refundedAmount._sum.refundAmount || refundedAmount._sum.amount || 0,
    partialRefunds,
    disputedPayments,
    platformCommission: platformCommission._sum.platformFee || 0,
    hospitalRevenue,
    clinicRevenue,
    referralCommission,
    subscriptionRevenue: subscriptionTotal,
    advertisementRevenue: adRevenue._sum.budget || 0,
    settlementPending: pendingAmount._sum.amount || 0,
    exceptionCount: exceptions.length,
    exceptions: exceptions.slice(0, 10),
  };
}

async function aggregateProviderRevenue(type: OrganizationType, statuses: PaymentStatus[]) {
  const result = await prisma.payment.aggregate({
    where: { status: { in: statuses }, bill: { organization: { type } } },
    _sum: { providerShare: true, amount: true },
  });
  return result._sum.providerShare || result._sum.amount || 0;
}

export async function listPayments(filters: PaymentListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = {
    ...(filters.status && { status: filters.status as PaymentStatus }),
    ...(filters.purpose && { purpose: filters.purpose as PaymentPurpose }),
    ...(filters.method && { method: filters.method as never }),
    ...(filters.gateway && { gateway: { contains: filters.gateway, mode: 'insensitive' } }),
    ...(filters.organizationId && { bill: { organizationId: filters.organizationId } }),
    ...(filters.organizationType && { bill: { organization: { type: filters.organizationType } } }),
    ...(filters.patientId && { bill: { patientId: filters.patientId } }),
    ...(filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59`) }),
      },
    },
    ...(filters.search && {
      OR: [
        { paymentNumber: { contains: filters.search, mode: 'insensitive' } },
        { transactionId: { contains: filters.search, mode: 'insensitive' } },
        { gatewayPaymentId: { contains: filters.search, mode: 'insensitive' } },
        { bill: { billNumber: { contains: filters.search, mode: 'insensitive' } } },
        { bill: { patient: { fullName: { contains: filters.search, mode: 'insensitive' } } } },
        { bill: { patient: { globalPatientId: { contains: filters.search, mode: 'insensitive' } } } },
        { bill: { organization: { name: { contains: filters.search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        bill: {
          include: {
            patient: { select: { id: true, fullName: true, globalPatientId: true } },
            organization: { select: { id: true, name: true, type: true, city: true } },
            appointment: { select: { id: true, appointmentNumber: true, doctorId: true, doctor: { select: { fullName: true } } } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, page, limit, total };
}

export async function getPaymentOverview(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      bill: {
        include: {
          patient: { include: { user: { select: { email: true, phone: true } } } },
          organization: true,
          appointment: { include: { doctor: true } },
          items: true,
        },
      },
    },
  });
  if (!payment) return null;

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'Payment', entityId: paymentId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { user: { select: { email: true } } },
  });

  return { payment, auditLogs };
}

export async function detectPaymentExceptions() {
  const exceptions: { level: string; message: string; paymentId?: string }[] = [];

  const capturedUnconfirmed = await prisma.payment.findMany({
    where: {
      status: { in: ['CAPTURED', 'COMPLETED'] },
      bill: { appointment: { status: 'PENDING' } },
    },
    take: 20,
    select: { id: true, paymentNumber: true },
  });
  for (const p of capturedUnconfirmed) {
    exceptions.push({ level: 'red', message: 'Payment captured but appointment unconfirmed', paymentId: p.id });
  }

  const webhookFailed = await prisma.payment.findMany({
    where: { webhookVerified: false, status: { in: ['CAPTURED', 'COMPLETED'] } },
    take: 20,
    select: { id: true, paymentNumber: true },
  });
  for (const p of webhookFailed) {
    exceptions.push({ level: 'orange', message: `Webhook not verified for ${p.paymentNumber}`, paymentId: p.id });
  }

  const duplicates = await prisma.payment.groupBy({
    by: ['gatewayPaymentId'],
    _count: true,
    having: { gatewayPaymentId: { _count: { gt: 1 } } },
    where: { gatewayPaymentId: { not: null } },
  });
  for (const d of duplicates) {
    exceptions.push({ level: 'red', message: `Duplicate gateway payment: ${d.gatewayPaymentId}` });
  }

  const refundPending = await prisma.payment.findMany({
    where: { status: 'REFUNDED', refundAmount: 0 },
    take: 10,
    select: { id: true, paymentNumber: true },
  });
  for (const p of refundPending) {
    exceptions.push({ level: 'yellow', message: `Refund status mismatch: ${p.paymentNumber}`, paymentId: p.id });
  }

  return exceptions;
}

export async function verifyPaymentWebhook(paymentId: string, actorUserId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { bill: { include: { appointment: true } } } });
  if (!payment) throw new Error('Payment not found');

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      webhookVerified: true,
      webhookStatus: 'VERIFIED',
      status: payment.status === 'PENDING' || payment.status === 'AUTHORIZED' ? 'COMPLETED' : payment.status,
      capturedAt: payment.capturedAt || new Date(),
      paidAt: payment.paidAt || new Date(),
    },
  });

  if (payment.bill.appointmentId) {
    await prisma.appointment.update({
      where: { id: payment.bill.appointmentId },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    });
    await prisma.bill.update({ where: { id: payment.billId }, data: { status: 'PAID' } });
  }

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'PAYMENT_WEBHOOK_VERIFIED',
      entityType: 'Payment',
      entityId: paymentId,
    },
  });

  return updated;
}

export async function processRefund(
  paymentId: string,
  amount: number,
  reason: string,
  actorUserId: string,
  fullRefund = false,
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('Payment not found');
  if (!['COMPLETED', 'CAPTURED', 'PARTIAL_REFUND'].includes(payment.status)) {
    throw new Error('Payment not eligible for refund');
  }

  const refundAmount = fullRefund ? payment.amount : amount;
  const isPartial = refundAmount < payment.amount;
  const status: PaymentStatus = isPartial ? 'PARTIAL_REFUND' : 'REFUNDED';

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status,
      refundAmount,
      refundReason: reason,
      refundId: `REF-${payment.paymentNumber}`,
    },
  });

  if (payment.billId) {
    await prisma.bill.update({
      where: { id: payment.billId },
      data: { status: isPartial ? 'PARTIALLY_PAID' : 'CANCELLED' },
    });
    const bill = await prisma.bill.findUnique({ where: { id: payment.billId }, select: { appointmentId: true } });
    if (bill?.appointmentId) {
      await prisma.appointment.update({
        where: { id: bill.appointmentId },
        data: { paymentStatus: isPartial ? 'PARTIAL_REFUND' : 'REFUNDED' },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'PAYMENT_REFUND',
      entityType: 'Payment',
      entityId: paymentId,
      details: { refundAmount, reason, fullRefund } as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export function paymentsToCsv(payments: Record<string, unknown>[]): string {
  const headers = ['Payment ID', 'Patient', 'Purpose', 'Provider', 'Amount', 'Method', 'Status', 'Gateway', 'Date'];
  const rows = payments.map((p) => {
    const bill = p.bill as {
      patient?: { fullName?: string };
      organization?: { name?: string };
    } | undefined;
    return [
      p.paymentNumber,
      bill?.patient?.fullName,
      p.purpose,
      bill?.organization?.name,
      p.amount,
      p.method,
      p.status,
      p.gateway,
      p.createdAt ? new Date(String(p.createdAt)).toISOString().slice(0, 10) : '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
