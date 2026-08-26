import { Router } from 'express';
import { z } from 'zod';
import { OrganizationType } from '@prisma/client';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  getPaymentManagementDashboard,
  listPayments,
  getPaymentOverview,
  detectPaymentExceptions,
  verifyPaymentWebhook,
  processRefund,
  paymentsToCsv,
} from '../../lib/payment-management';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getPaymentManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/exceptions', async (_req, res, next) => {
  try {
    sendSuccess(res, await detectPaymentExceptions());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { payments } = await listPayments({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = paymentsToCsv(payments as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const orgType = req.query.organizationType as string | undefined;
    const result = await listPayments({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      purpose: req.query.purpose as string | undefined,
      method: req.query.method as string | undefined,
      gateway: req.query.gateway as string | undefined,
      organizationId: req.query.organizationId as string | undefined,
      organizationType: orgType === 'HOSPITAL' || orgType === 'CLINIC' ? orgType as OrganizationType : undefined,
      patientId: req.query.patientId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.payments, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getPaymentOverview(id);
    if (!overview) throw new AppError('Payment not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.post('/:id/verify', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const payment = await verifyPaymentWebhook(id, req.user!.userId);
    await logAudit(req, 'VERIFY', 'Payment', id);
    sendSuccess(res, payment, 'Payment verified via webhook');
  } catch (err) { next(err); }
});

router.post('/:id/refund', validateBody(z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(5),
  fullRefund: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const payment = await processRefund(
      id,
      req.body.amount || 0,
      req.body.reason,
      req.user!.userId,
      req.body.fullRefund ?? !req.body.amount,
    );
    await logAudit(req, 'REFUND', 'Payment', id, req.body);
    sendSuccess(res, payment, 'Refund processed');
  } catch (err) { next(err); }
});

export default router;
