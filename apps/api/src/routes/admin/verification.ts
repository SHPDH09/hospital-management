import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import {
  assignVerifier,
  approveApplication,
  rejectApplication,
  verifyDocument,
  rejectDocument,
  requestReVerification,
  getVerificationDashboardStats,
  DEFAULT_CHECKLIST,
  DOCUMENT_TYPES,
} from '../../lib/verification-service';
const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const stats = await getVerificationDashboardStats();
    sendSuccess(res, stats);
  } catch (err) { next(err); }
});

router.get('/applications', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const assignedVerifierId = req.query.assignedVerifierId as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    const search = req.query.search as string | undefined;

    const where = {
      ...(status && { status: status as never }),
      ...(type && { type: type as never }),
      ...(assignedVerifierId && { assignedVerifierId }),
      ...(riskLevel && { riskLevel: riskLevel as never }),
      ...(search && {
        OR: [
          { applicationNumber: { contains: search, mode: 'insensitive' as const } },
          { organization: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [applications, total] = await Promise.all([
      prisma.verificationApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          organization: { select: { id: true, name: true, city: true, type: true } },
          doctor: { select: { id: true, fullName: true } },
          ashaProfile: { select: { id: true, ashaName: true } },
          referralPartner: { select: { id: true, referralPartnerName: true } },
          assignedVerifier: { select: { id: true, email: true } },
          _count: { select: { documents: true } },
        },
      }),
      prisma.verificationApplication.count({ where }),
    ]);

    sendPaginated(res, applications, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/applications/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const app = await prisma.verificationApplication.findUnique({
      where: { id },
      include: {
        organization: true,
        doctor: true,
        ashaProfile: true,
        referralPartner: true,
        documents: { orderBy: { createdAt: 'desc' } },
        auditLogs: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true } } } },
        assignedVerifier: { select: { id: true, email: true } },
        submittedBy: { select: { id: true, email: true } },
      },
    });
    if (!app) throw new AppError('Application not found', 404);
    sendSuccess(res, app);
  } catch (err) { next(err); }
});

router.post('/applications/:id/assign', validateBody(z.object({ verifierId: z.string().uuid() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const app = await assignVerifier(id, req.body.verifierId, req.user!.userId, req.user!.email);
    sendSuccess(res, app, 'Verifier assigned');
  } catch (err) { next(err); }
});

router.patch('/documents/:id/verify', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doc = await verifyDocument(id, req.user!.userId, req.user!.email);
    sendSuccess(res, doc, 'Document verified');
  } catch (err) { next(err); }
});

router.patch('/documents/:id/reject', validateBody(z.object({ reason: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doc = await rejectDocument(id, req.body.reason, req.user!.userId, req.user!.email);
    sendSuccess(res, doc, 'Document rejected');
  } catch (err) { next(err); }
});

router.post('/applications/:id/approve', validateBody(z.object({
  checklist: z.record(z.boolean()).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const checklist = { ...DEFAULT_CHECKLIST, ...(req.body.checklist || {}) };
    const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
    const app = await approveApplication(id, req.user!.userId, checklist, req.user!.email, isSuperAdmin);
    sendSuccess(res, app, 'Application approved — account activated');
  } catch (err) { next(err); }
});

router.post('/applications/:id/reject', validateBody(z.object({ reason: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const app = await rejectApplication(id, req.body.reason, req.user!.userId, req.user!.email);
    sendSuccess(res, app, 'Application rejected');
  } catch (err) { next(err); }
});

router.post('/organizations/:orgId/re-verify', validateBody(z.object({ reason: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const orgId = paramId(req.params.orgId);
    const app = await requestReVerification(orgId, req.body.reason, req.user!.userId);
    sendSuccess(res, app, 'Re-verification requested');
  } catch (err) { next(err); }
});

router.get('/document-types', (_req, res) => {
  sendSuccess(res, DOCUMENT_TYPES);
});

router.get('/verifiers', async (_req, res, next) => {
  try {
    const verifiers = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'PLATFORM_STAFF'] }, isActive: true },
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    });
    sendSuccess(res, verifiers);
  } catch (err) { next(err); }
});

export default router;
