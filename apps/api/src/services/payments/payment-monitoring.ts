import { prisma } from '../../lib/prisma';
import { notifyPlatformAdmins } from '../notifications/notification-service';
import { aiComplete, isAiFeatureEnabled } from '../ai';

export interface PaymentAlert {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  count?: number;
  details?: Record<string, unknown>;
}

export async function detectPaymentAnomalies(): Promise<PaymentAlert[]> {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 3600000);

  const [recentFailed, priorFailed, recentCompleted, duplicateCandidates, pendingBillsWithPayment] = await Promise.all([
    prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: twoHoursAgo } } }),
    prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: fourHoursAgo, lt: twoHoursAgo } } }),
    prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: twoHoursAgo } },
      select: { id: true, billId: true, amount: true, transactionId: true },
    }),
    prisma.payment.groupBy({
      by: ['billId', 'amount'],
      where: { status: 'COMPLETED', createdAt: { gte: twoHoursAgo } },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    }),
    prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: twoHoursAgo } },
      include: { bill: { select: { status: true, billNumber: true } } },
      take: 50,
    }),
  ]);

  const alerts: PaymentAlert[] = [];

  if (priorFailed > 0 && recentFailed > priorFailed * 1.35) {
    const pct = Math.round(((recentFailed - priorFailed) / priorFailed) * 100);
    alerts.push({
      type: 'failure_spike',
      severity: pct >= 50 ? 'HIGH' : 'MEDIUM',
      message: `Payment failures increased ${pct}% in the last 2 hours (${recentFailed} vs ${priorFailed} prior period).`,
      count: recentFailed,
    });
  } else if (priorFailed === 0 && recentFailed >= 5) {
    alerts.push({
      type: 'failure_spike',
      severity: 'HIGH',
      message: `${recentFailed} payment failures in the last 2 hours.`,
      count: recentFailed,
    });
  }

  if (duplicateCandidates.length > 0) {
    alerts.push({
      type: 'duplicate_payment',
      severity: 'HIGH',
      message: `${duplicateCandidates.length} potential duplicate payment(s) detected (same bill and amount).`,
      count: duplicateCandidates.length,
      details: { groups: duplicateCandidates },
    });
  }

  const mismatched = pendingBillsWithPayment.filter((p) => p.bill.status === 'PENDING' || p.bill.status === 'DRAFT');
  if (mismatched.length > 0) {
    alerts.push({
      type: 'payment_bill_mismatch',
      severity: 'HIGH',
      message: `${mismatched.length} completed payment(s) linked to unpaid bills — manual reconciliation required.`,
      count: mismatched.length,
      details: { paymentIds: mismatched.map((p) => p.id) },
    });
  }

  const nullTxn = recentCompleted.filter((p) => !p.transactionId).length;
  if (nullTxn > 3) {
    alerts.push({
      type: 'missing_transaction_id',
      severity: 'MEDIUM',
      message: `${nullTxn} completed payments missing gateway transaction IDs in the last 2 hours.`,
      count: nullTxn,
    });
  }

  return alerts;
}

export async function scanPaymentAnomalies(): Promise<PaymentAlert[]> {
  const alerts = await detectPaymentAnomalies();
  for (const alert of alerts.filter((a) => a.severity === 'HIGH')) {
    await notifyPlatformAdmins('Payment Alert', alert.message, 'payment_alert');
  }
  return alerts;
}

export async function getPaymentMonitoringDashboard() {
  const alerts = await detectPaymentAnomalies();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayCompleted, todayFailed, todayRefunded, totalVolume] = await Promise.all([
    prisma.payment.count({ where: { status: 'COMPLETED', createdAt: { gte: today } } }),
    prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: today } } }),
    prisma.payment.count({ where: { status: 'REFUNDED', createdAt: { gte: today } } }),
    prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
  ]);

  let insight: string | null = null;
  if (await isAiFeatureEnabled('copilot') && alerts.length > 0) {
    const ai = await aiComplete({
      module: 'payments',
      feature: 'payment_insight',
      system: 'Summarize payment monitoring alerts in 1-2 sentences. Use only provided data.',
      user: `Alerts: ${JSON.stringify(alerts)}. Today: ${todayCompleted} completed, ${todayFailed} failed.`,
    });
    if (ai.fromAi) insight = ai.text;
  }

  return {
    alerts,
    today: {
      completed: todayCompleted,
      failed: todayFailed,
      refunded: todayRefunded,
      volume: totalVolume._sum.amount || 0,
    },
    insight,
  };
}
