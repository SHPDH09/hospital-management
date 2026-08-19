import { Router } from 'express';
import { processJobBatch } from '../../services/jobs/queue';
import { scanUpcomingAppointmentReminders } from '../../services/appointments/reminder-service';
import { sendSuccess, sendError } from '../../lib/response';

const router = Router();

async function runScheduledScans() {
  const { scanPaymentAnomalies } = await import('../../services/payments/payment-monitoring');
  const { processSubscriptionRenewalReminders } = await import('../../services/subscriptions/subscription-automation');
  const { scanUpcomingNoShowRisk } = await import('../../services/appointments/no-show-batch');
  await Promise.all([
    scanPaymentAnomalies().catch(console.error),
    processSubscriptionRenewalReminders().catch(console.error),
    scanUpcomingNoShowRisk().catch(console.error),
  ]);
}

function verifyCronSecret(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const secret = process.env.CRON_SECRET || process.env.JOB_WORKER_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = req.headers['x-cron-secret'] || req.headers.authorization;
  if (typeof header === 'string' && header === secret) return true;
  if (typeof header === 'string' && header === `Bearer ${secret}`) return true;
  return false;
}

router.post('/process', async (req, res, next) => {
  try {
    if (!verifyCronSecret(req)) return sendError(res, 'Unauthorized', 401);

    const [jobResults, remindersScheduled] = await Promise.all([
      runScheduledScans().then(() => processJobBatch(25)),
      scanUpcomingAppointmentReminders(),
    ]);

    sendSuccess(res, { processed: jobResults.length, jobResults, remindersScheduled });
  } catch (err) { next(err); }
});

router.get('/process', async (req, res, next) => {
  try {
    if (!verifyCronSecret(req)) return sendError(res, 'Unauthorized', 401);
    const [jobResults, remindersScheduled] = await Promise.all([
      runScheduledScans().then(() => processJobBatch(25)),
      scanUpcomingAppointmentReminders(),
    ]);
    sendSuccess(res, { processed: jobResults.length, jobResults, remindersScheduled });
  } catch (err) { next(err); }
});

export default router;
