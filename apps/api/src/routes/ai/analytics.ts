import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../lib/response';
import { getPaymentMonitoringDashboard } from '../../services/payments/payment-monitoring';
import { getSubscriptionRenewalDashboard } from '../../services/subscriptions/subscription-automation';
import { getCampaignAnalytics } from '../../services/analytics/campaign-analytics';
import { getReferralAnalytics } from '../../services/analytics/referral-analytics';
import { getNoShowRiskDashboard } from '../../services/appointments/no-show-batch';
import { recommendSlots } from '../../services/appointments/slot-recommendation';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/payments', async (_req, res, next) => {
  try {
    sendSuccess(res, await getPaymentMonitoringDashboard());
  } catch (err) { next(err); }
});

router.get('/subscriptions', async (_req, res, next) => {
  try {
    sendSuccess(res, await getSubscriptionRenewalDashboard());
  } catch (err) { next(err); }
});

router.get('/campaigns', async (_req, res, next) => {
  try {
    sendSuccess(res, await getCampaignAnalytics());
  } catch (err) { next(err); }
});

router.get('/referrals', async (_req, res, next) => {
  try {
    sendSuccess(res, await getReferralAnalytics());
  } catch (err) { next(err); }
});

router.get('/appointments/risk', async (_req, res, next) => {
  try {
    sendSuccess(res, await getNoShowRiskDashboard());
  } catch (err) { next(err); }
});

router.post('/appointments/slots/recommend', validateBody(z.object({
  doctorId: z.string().uuid(),
  date: z.string().optional(),
  preferredTime: z.string().optional(),
  limit: z.number().optional(),
})), async (req, res, next) => {
  try {
    const slots = await recommendSlots(req.body);
    sendSuccess(res, { slots, count: slots.length });
  } catch (err) { next(err); }
});

router.get('/overview', async (_req, res, next) => {
  try {
    const [payments, subscriptions, campaigns, referrals, appointments] = await Promise.all([
      getPaymentMonitoringDashboard(),
      getSubscriptionRenewalDashboard(),
      getCampaignAnalytics(),
      getReferralAnalytics(),
      getNoShowRiskDashboard(),
    ]);
    sendSuccess(res, { payments, subscriptions, campaigns, referrals, appointments });
  } catch (err) { next(err); }
});

export default router;
