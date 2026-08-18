import { prisma } from '../../lib/prisma';
import { enqueueJob } from '../jobs/queue';

export type AutomationEvent =
  | 'appointment.created'
  | 'appointment.upcoming'
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.no_followup'
  | 'payment.completed'
  | 'payment.failed'
  | 'review.created'
  | 'complaint.created'
  | 'subscription.expiring'
  | 'verification.pending';

export async function emitAutomationEvent(
  trigger: AutomationEvent,
  entityType: string,
  entityId: string,
  context: Record<string, unknown> = {}
) {
  const rules = await prisma.automationRule.findMany({
    where: { isActive: true, trigger },
  });

  for (const rule of rules) {
    const conditions = (rule.conditions as unknown[]) || [];
    if (!evaluateConditions(conditions, context)) continue;

    const delayMs = (rule.delayMinutes || 0) * 60000;
    await enqueueJob(
      'automation_execute',
      { ruleId: rule.id, entityType, entityId, context },
      new Date(Date.now() + delayMs)
    );
  }
}

function evaluateConditions(conditions: unknown[], context: Record<string, unknown>): boolean {
  if (!conditions.length) return true;
  return conditions.every((cond) => {
    const c = cond as { field: string; operator: string; value: unknown };
    const actual = context[c.field];
    switch (c.operator) {
      case 'eq': return actual === c.value;
      case 'neq': return actual !== c.value;
      case 'gt': return Number(actual) > Number(c.value);
      case 'gte': return Number(actual) >= Number(c.value);
      case 'lt': return Number(actual) < Number(c.value);
      case 'lte': return Number(actual) <= Number(c.value);
      case 'in': return Array.isArray(c.value) && c.value.includes(actual);
      default: return true;
    }
  });
}

export async function seedDefaultAutomations() {
  const defaults = [
    {
      name: 'Appointment Booking Confirmation',
      module: 'APPOINTMENTS' as const,
      trigger: 'appointment.created',
      conditions: [],
      actions: [{ type: 'send_notification', title: 'Appointment Booked', message: 'Your appointment has been booked.' }],
      channel: 'push,email',
      isActive: true,
    },
    {
      name: 'Appointment Reminder 24h',
      module: 'APPOINTMENTS' as const,
      trigger: 'appointment.upcoming',
      conditions: [{ field: 'hoursBefore', operator: 'eq', value: 24 }],
      actions: [{ type: 'send_reminder', reminderType: '24h' }],
      channel: 'push,email,sms',
      isActive: true,
    },
    {
      name: 'Hot Lead Alert',
      module: 'LEADS' as const,
      trigger: 'lead.status_changed',
      conditions: [{ field: 'temperature', operator: 'eq', value: 'HOT' }],
      actions: [{ type: 'alert_admin', title: 'Hot Lead', message: 'A lead was classified as HOT.' }],
      channel: 'push',
      isActive: true,
    },
    {
      name: 'Negative Review Alert',
      module: 'REVIEWS' as const,
      trigger: 'review.created',
      conditions: [{ field: 'rating', operator: 'lte', value: 2 }],
      actions: [{ type: 'alert_admin', title: 'Low Rating Review', message: 'A low rating review needs attention.' }],
      channel: 'push',
      isActive: true,
    },
    {
      name: 'Critical Support Ticket',
      module: 'COMPLAINTS' as const,
      trigger: 'complaint.created',
      conditions: [{ field: 'priority', operator: 'eq', value: 'URGENT' }],
      actions: [{ type: 'alert_admin', title: 'Critical Ticket', message: 'Urgent support ticket created.' }],
      channel: 'push',
      isActive: true,
    },
  ];

  for (const rule of defaults) {
    const existing = await prisma.automationRule.findFirst({ where: { name: rule.name } });
    if (!existing) {
      await prisma.automationRule.create({ data: rule });
    }
  }
}
