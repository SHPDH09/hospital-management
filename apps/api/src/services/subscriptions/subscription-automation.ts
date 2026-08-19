import { prisma } from '../../lib/prisma';
import { emitAutomationEvent } from '../automation/engine';
import { sendInAppNotification } from '../notifications/notification-service';
import { aiComplete, isAiFeatureEnabled } from '../ai';

export async function getExpiringSubscriptions(daysAhead = 14) {
  const now = new Date();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysAhead);

  const expiring = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIAL'] },
      endDate: { gte: now, lte: deadline },
    },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { name: true } },
    },
    orderBy: { endDate: 'asc' },
  });

  return expiring.map((sub) => ({
    subscriptionId: sub.id,
    organization: sub.organization.name,
    plan: sub.plan.name,
    endDate: sub.endDate,
    daysLeft: sub.endDate ? Math.ceil((sub.endDate.getTime() - now.getTime()) / 86400000) : 0,
  }));
}

export async function processSubscriptionRenewalReminders(daysAhead = 7) {
  const now = new Date();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysAhead);

  const expiring = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIAL'] },
      endDate: { gte: now, lte: deadline },
    },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { name: true } },
    },
  });

  const results = [];

  for (const sub of expiring) {
    const daysLeft = sub.endDate
      ? Math.ceil((sub.endDate.getTime() - now.getTime()) / 86400000)
      : 0;

    const staffAdmins = await prisma.staff.findMany({
      where: { organizationId: sub.organizationId, isActive: true },
      include: { user: { select: { id: true, role: true } } },
    });
    const adminUsers = staffAdmins.filter((s) => ['HOSPITAL_ADMIN', 'BRANCH_ADMIN'].includes(s.user.role));

    const message = `${sub.organization.name} subscription (${sub.plan.name}) expires in ${daysLeft} day(s).`;

    for (const admin of adminUsers) {
      await sendInAppNotification({
        userId: admin.userId,
        title: 'Subscription Renewal Reminder',
        message,
        type: 'subscription_renewal',
        data: { subscriptionId: sub.id, daysLeft },
      });
    }

    await emitAutomationEvent('subscription.expiring', 'subscription', sub.id, {
      daysLeft,
      organizationId: sub.organizationId,
      planName: sub.plan.name,
    });

    results.push({
      subscriptionId: sub.id,
      organization: sub.organization.name,
      daysLeft,
      notifiedAdmins: adminUsers.length,
    });
  }

  return results;
}

export async function getSubscriptionRenewalDashboard() {
  const renewals = await getExpiringSubscriptions(14);
  const atRisk = await prisma.subscription.count({
    where: {
      status: 'ACTIVE',
      endDate: { lte: new Date(Date.now() + 7 * 86400000) },
    },
  });
  const inactive = await prisma.subscription.count({
    where: {
      status: 'ACTIVE',
      updatedAt: { lt: new Date(Date.now() - 90 * 86400000) },
    },
  });

  let insight: string | null = null;
  if (await isAiFeatureEnabled('copilot') && renewals.length > 0) {
    const ai = await aiComplete({
      module: 'subscriptions',
      feature: 'renewal_insight',
      system: 'Summarize subscription renewal opportunities in 1-2 sentences.',
      user: `${renewals.length} subscriptions expiring within 14 days. At-risk within 7 days: ${atRisk}.`,
    });
    if (ai.fromAi) insight = ai.text;
  }

  return { renewals, atRisk, inactiveOrStale: inactive, insight };
}
