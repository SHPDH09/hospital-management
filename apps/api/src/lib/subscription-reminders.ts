import { prisma } from './prisma';

// Runs the subscription renewal lifecycle:
//  - 7 / 3 / 1 day-before in-app renewal reminders (deduped per cycle)
//  - marks ACTIVE subscriptions past endDate as EXPIRED
//  - suspends subscriptions still unpaid after the grace period
//
// Designed to be triggered on a schedule (cron/worker). Here it is exposed via
// an admin endpoint since the environment has no scheduler.
const REMINDER_DAYS = [7, 3, 1];

export async function runSubscriptionReminders(graceDays = 3) {
  const now = new Date();
  const result = { remindersCreated: 0, expired: 0, suspended: 0 };

  const active = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] }, endDate: { not: null, gte: now } },
    include: { plan: true },
  });

  for (const sub of active) {
    if (!sub.endDate) continue;
    const days = Math.ceil((sub.endDate.getTime() - now.getTime()) / 86_400_000);
    if (!REMINDER_DAYS.includes(days)) continue;

    const admins = await prisma.staff.findMany({
      where: { organizationId: sub.organizationId, role: { in: ['HOSPITAL_ADMIN', 'BRANCH_ADMIN'] } },
      select: { userId: true },
    });
    const cycleEnd = sub.endDate.toISOString();

    for (const a of admins) {
      // Dedupe: one reminder per (subscription, day-mark, cycle end) per admin.
      const already = await prisma.notification.findFirst({
        where: {
          userId: a.userId,
          type: 'SUBSCRIPTION_REMINDER',
          AND: [
            { data: { path: ['subscriptionId'], equals: sub.id } },
            { data: { path: ['daysBefore'], equals: days } },
            { data: { path: ['cycleEnd'], equals: cycleEnd } },
          ],
        },
      });
      if (already) continue;

      const isFinal = days === 1;
      await prisma.notification.create({
        data: {
          userId: a.userId,
          type: 'SUBSCRIPTION_REMINDER',
          title: isFinal ? 'Final renewal reminder' : `Subscription renewal in ${days} days`,
          message: `Your ${sub.plan.name} plan expires on ${sub.endDate.toDateString()}. Renew now to avoid interruption.`,
          data: { subscriptionId: sub.id, daysBefore: days, cycleEnd, planName: sub.plan.name, endDate: cycleEnd },
        },
      });
      result.remindersCreated += 1;
    }
  }

  // Expire subscriptions that are past their end date.
  const expired = await prisma.subscription.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: now } },
    data: { status: 'EXPIRED' },
  });
  result.expired = expired.count;

  // Suspend subscriptions still expired after the grace period.
  const graceCutoff = new Date(now.getTime() - graceDays * 86_400_000);
  const suspended = await prisma.subscription.updateMany({
    where: { status: 'EXPIRED', endDate: { lt: graceCutoff } },
    data: { status: 'SUSPENDED', suspendReason: 'Not renewed within grace period' },
  });
  result.suspended = suspended.count;

  return result;
}
