import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess, sendPaginated } from '../../lib/response';
import {
  listApprovalRequests,
  reviewApprovalRequest,
  getPendingApprovalCount,
} from '../../services/approvals/approval-service';
import { analyzeOrganizationVerification } from '../../services/documents/verification-assistant';
import { paramId } from '../../lib/params';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await listApprovalRequests({ status, page, limit });
    sendPaginated(res, result.requests, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const pending = await getPendingApprovalCount();
    sendSuccess(res, { pending });
  } catch (err) { next(err); }
});

router.post('/organizations/:id/analyze', async (req: AuthRequest, res, next) => {
  try {
    const result = await analyzeOrganizationVerification(
      paramId(req.params.id),
      req.user!.userId
    );
    sendSuccess(res, result, 'Verification analysis complete — pending human approval');
  } catch (err) { next(err); }
});

router.post('/:id/review', validateBody(z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const updated = await reviewApprovalRequest(
      paramId(req.params.id),
      req.user!.userId,
      req.body.decision,
      req.body.notes
    );
    sendSuccess(res, updated, `Request ${req.body.decision.toLowerCase()}`);
  } catch (err) { next(err); }
});

export default router;
