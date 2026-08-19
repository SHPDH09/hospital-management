import { Router } from 'express';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES, CRM_ROLES, tenantScope } from '../../middleware/auth';
import { sendSuccess } from '../../lib/response';
import {
  findDuplicatePatients,
  getPatientTimeline,
  updatePatientProfileCompletion,
  batchUpdateProfileCompletion,
} from '../../services/patients/profile-intelligence';
import { paramId } from '../../lib/params';

const router = Router();
router.use(authenticate);

router.get('/duplicates', requireRoles(...PLATFORM_ROLES, ...CRM_ROLES), tenantScope, async (req: AuthRequest, res, next) => {
  try {
    const result = await findDuplicatePatients({
      organizationId: req.user!.organizationId,
      limit: Number(req.query.limit) || 20,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/:id/timeline', requireRoles(...PLATFORM_ROLES, ...CRM_ROLES), async (req, res, next) => {
  try {
    const result = await getPatientTimeline(paramId(req.params.id));
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.post('/:id/completion', requireRoles(...PLATFORM_ROLES, ...CRM_ROLES), async (req, res, next) => {
  try {
    const result = await updatePatientProfileCompletion(paramId(req.params.id));
    sendSuccess(res, result, 'Profile completion updated');
  } catch (err) { next(err); }
});

router.post('/batch-completion', requireRoles(...PLATFORM_ROLES), async (req: AuthRequest, res, next) => {
  try {
    const result = await batchUpdateProfileCompletion(req.body?.organizationId);
    sendSuccess(res, result, 'Batch profile completion updated');
  } catch (err) { next(err); }
});

export default router;
