import { Router } from 'express';
import { z } from 'zod';
import { OrganizationType, ReviewStatus } from '@prisma/client';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  getReviewManagementDashboard,
  listReviews,
  getReviewOverview,
  moderateReview,
  addProviderResponse,
  flagReview,
  resolveReport,
  detectFraudFlags,
  reviewsToCsv,
} from '../../lib/review-management';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

const statusEnum = z.enum([
  'PENDING', 'UNDER_MODERATION', 'APPROVED', 'REJECTED', 'HIDDEN',
  'REPORTED', 'FLAGGED', 'REMOVED', 'RESTORED',
]);

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getReviewManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/fraud-flags', async (_req, res, next) => {
  try {
    sendSuccess(res, await detectFraudFlags());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { reviews } = await listReviews({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = reviewsToCsv(reviews as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reviews.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const orgType = req.query.organizationType as string | undefined;
    const result = await listReviews({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      source: req.query.source as string | undefined,
      rating: req.query.rating ? Number(req.query.rating) : undefined,
      organizationId: req.query.organizationId as string | undefined,
      organizationType: orgType === 'HOSPITAL' || orgType === 'CLINIC' ? orgType as OrganizationType : undefined,
      doctorId: req.query.doctorId as string | undefined,
      patientId: req.query.patientId as string | undefined,
      isVerifiedVisit: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined,
      reported: req.query.reported === 'true',
      sentiment: req.query.sentiment as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.reviews, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getReviewOverview(id);
    if (!overview) throw new AppError('Review not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.post('/:id/moderate', validateBody(z.object({
  status: statusEnum,
  reason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const review = await moderateReview(id, req.body.status as ReviewStatus, req.user!.userId, req.body.reason);
    await logAudit(req, 'MODERATE', 'Review', id, req.body);
    sendSuccess(res, review, 'Review moderated');
  } catch (err) { next(err); }
});

router.post('/:id/flag', validateBody(z.object({ reason: z.string().min(3) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const review = await flagReview(id, req.body.reason, req.user!.userId);
    await logAudit(req, 'FLAG', 'Review', id, req.body);
    sendSuccess(res, review, 'Review flagged');
  } catch (err) { next(err); }
});

router.post('/:id/response', validateBody(z.object({ response: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const review = await addProviderResponse(id, req.body.response, req.user!.userId);
    await logAudit(req, 'RESPONSE', 'Review', id);
    sendSuccess(res, review, 'Response published');
  } catch (err) { next(err); }
});

router.post('/reports/:reportId/resolve', validateBody(z.object({
  decision: z.string().min(3),
  reviewAction: statusEnum.optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const reportId = paramId(req.params.reportId);
    const report = await resolveReport(
      reportId,
      req.body.decision,
      req.user!.userId,
      req.body.reviewAction as ReviewStatus | undefined,
    );
    sendSuccess(res, report, 'Report resolved');
  } catch (err) { next(err); }
});

export default router;
