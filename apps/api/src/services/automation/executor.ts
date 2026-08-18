import { prisma } from '../../lib/prisma';
import { notifyPlatformAdmins, sendMultiChannel } from '../notifications/notification-service';

export async function executeAutomationAction(payload: Record<string, unknown>) {
  const ruleId = payload.ruleId as string;
  const entityType = payload.entityType as string;
  const entityId = payload.entityId as string;
  const context = (payload.context as Record<string, unknown>) || {};

  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.isActive) return;

  const actions = (rule.actions as { type: string; [key: string]: unknown }[]) || [];
  const channels = (rule.channel || 'push').split(',').map((c) => c.trim());
  const results: unknown[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'send_notification':
        case 'send_reminder': {
          if (entityType === 'appointment') {
            const appt = await prisma.appointment.findUnique({
              where: { id: entityId },
              include: { patient: { include: { user: true } }, doctor: { select: { fullName: true } }, organization: { select: { name: true } } },
            });
            if (appt?.patient.user) {
              const title = (action.title as string) || 'Appointment Reminder';
              const message = `Reminder: Appointment with Dr. ${appt.doctor.fullName} at ${appt.organization.name} on ${appt.appointmentDate.toISOString().slice(0, 10)} at ${appt.startTime}.`;
              results.push(await sendMultiChannel(channels, {
                userId: appt.patient.user.id,
                email: appt.patient.user.email,
                phone: appt.patient.user.phone || undefined,
              }, title, message));
            }
          }
          break;
        }
        case 'alert_admin': {
          await notifyPlatformAdmins(
            (action.title as string) || 'Automation Alert',
            (action.message as string) || `Event on ${entityType} ${entityId}`,
            'automation'
          );
          results.push({ type: 'alert_admin' });
          break;
        }
        case 'create_followup': {
          if (entityType === 'lead') {
            await prisma.leadActivity.create({
              data: {
                leadId: entityId,
                action: 'AUTOMATION_FOLLOWUP',
                notes: (action.message as string) || 'Automated follow-up task created',
              },
            });
            results.push({ type: 'create_followup' });
          }
          break;
        }
        case 'add_tag':
        case 'add_note':
          results.push({ type: action.type, skipped: 'requires manual review' });
          break;
        default:
          results.push({ type: action.type, status: 'unknown_action' });
      }
    } catch (err) {
      results.push({ type: action.type, error: err instanceof Error ? err.message : 'failed' });
    }
  }

  await prisma.automationExecution.create({
    data: {
      ruleId,
      entityType,
      entityId,
      status: 'completed',
      result: { actions: results, context } as object,
    },
  });
}
