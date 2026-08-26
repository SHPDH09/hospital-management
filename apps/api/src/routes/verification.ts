import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { sendSuccess, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import {
  getApplicationForUser,
  isAccountActivated,
  addApplicationDocument,
  reuploadDocument,
  DOCUMENT_TYPES,
} from '../lib/verification-service';

const router = Router();

const PROVIDER_ROLES = [...CRM_ROLES, 'ASHA', 'REFERRAL_PARTNER'] as const;

router.use(authenticate, requireRoles(...PROVIDER_ROLES));

router.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const activated = await isAccountActivated(req.user!.userId, req.user!.role);
    const application = await getApplicationForUser(req.user!.userId, req.user!.role);
    sendSuccess(res, {
      accountActivated: activated,
      application,
      canAccessDashboard: activated,
    });
  } catch (err) { next(err); }
});

router.get('/my', async (req: AuthRequest, res, next) => {
  try {
    const application = await getApplicationForUser(req.user!.userId, req.user!.role);
    if (!application) throw new AppError('No verification application found', 404);
    sendSuccess(res, application);
  } catch (err) { next(err); }
});

router.post('/documents', validateBody(z.object({
  documentType: z.string(),
  fileName: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  expiryDate: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const application = await getApplicationForUser(req.user!.userId, req.user!.role);
    if (!application) throw new AppError('No verification application found', 404);

    const doc = await addApplicationDocument(application.id, {
      ...req.body,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
    }, req.user!.userId);

    sendSuccess(res, doc, 'Document uploaded', 201);
  } catch (err) { next(err); }
});

router.post('/documents/:id/reupload', validateBody(z.object({
  fileName: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const application = await getApplicationForUser(req.user!.userId, req.user!.role);
    if (!application) throw new AppError('No verification application found', 404);
    const docId = paramId(req.params.id);
    const doc = await reuploadDocument(application.id, docId, req.body, req.user!.userId);
    sendSuccess(res, doc, 'Document re-uploaded', 201);
  } catch (err) { next(err); }
});

router.get('/document-types', (_req, res) => {
  sendSuccess(res, DOCUMENT_TYPES);
});

export default router;
