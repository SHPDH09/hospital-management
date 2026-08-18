import { Router } from 'express';
import { z } from 'zod';
import { OrganizationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { signAccessToken, signRefreshToken } from '../../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  getPatientManagementDashboard,
  listPatients,
  getPatientOverview,
  verifyPatient,
  blockPatient,
  activatePatient,
  detectDuplicatePatients,
  mergePatients,
  patientsToCsv,
} from '../../lib/patient-management';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getPatientManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/duplicates', async (_req, res, next) => {
  try {
    sendSuccess(res, await detectDuplicatePatients());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { patients } = await listPatients({
      search: req.query.search as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = patientsToCsv(patients as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=patients.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const orgType = req.query.organizationType as string | undefined;
    const result = await listPatients({
      search: req.query.search as string | undefined,
      city: req.query.city as string | undefined,
      state: req.query.state as string | undefined,
      organizationId: req.query.organizationId as string | undefined,
      organizationType: orgType === 'HOSPITAL' || orgType === 'CLINIC' ? orgType as OrganizationType : undefined,
      doctorId: req.query.doctorId as string | undefined,
      accountStatus: req.query.accountStatus as string | undefined,
      registrationSource: req.query.registrationSource as string | undefined,
      referralOnly: req.query.referralOnly === 'true',
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.patients, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.post('/merge', validateBody(z.object({
  primaryId: z.string().uuid(),
  secondaryId: z.string().uuid(),
})), async (req: AuthRequest, res, next) => {
  try {
    const overview = await mergePatients(req.body.primaryId, req.body.secondaryId, req.user!.userId);
    await logAudit(req, 'MERGE', 'Patient', req.body.primaryId, req.body);
    sendSuccess(res, overview, 'Patients merged');
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getPatientOverview(id);
    if (!overview) throw new AppError('Patient not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.get('/:id/appointments', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: id },
        skip,
        take: limit,
        orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        include: {
          doctor: { select: { fullName: true, specialization: true } },
          organization: { select: { name: true, type: true, logoUrl: true } },
        },
      }),
      prisma.appointment.count({ where: { patientId: id } }),
    ]);
    sendPaginated(res, appointments, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/:id/organizations', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orgs = await prisma.patientOrganization.findMany({
      where: { patientId: id },
      include: {
        organization: { select: { id: true, name: true, type: true, city: true, logoUrl: true } },
      },
    });
    sendSuccess(res, orgs);
  } catch (err) { next(err); }
});

router.get('/:id/audit-logs', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await prisma.patient.findUnique({ where: { id }, select: { userId: true } });
    const logs = await prisma.auditLog.findMany({
      where: { OR: [{ entityType: 'Patient', entityId: id }, { userId: patient?.userId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { email: true } } },
    });
    sendSuccess(res, logs);
  } catch (err) { next(err); }
});

router.patch('/:id/profile', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { accountStatus: _as, globalPatientId: _gid, ...data } = req.body;
    const patient = await prisma.patient.update({ where: { id }, data });
    await logAudit(req, 'UPDATE', 'Patient', id, data);
    sendSuccess(res, patient, 'Patient profile updated');
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { isActive } = req.body;
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new AppError('Patient not found', 404);
    await prisma.user.update({ where: { id: patient.userId }, data: { isActive } });
    await logAudit(req, 'STATUS_CHANGE', 'Patient', id, { isActive });
    sendSuccess(res, { id, isActive });
  } catch (err) { next(err); }
});

router.post('/:id/verify', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await verifyPatient(id, req.user!.userId);
    await logAudit(req, 'VERIFY', 'Patient', id);
    sendSuccess(res, patient, 'Patient verified');
  } catch (err) { next(err); }
});

router.post('/:id/block', validateBody(z.object({ reason: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await blockPatient(id, req.body.reason, req.user!.userId);
    await logAudit(req, 'BLOCK', 'Patient', id, req.body);
    sendSuccess(res, patient, 'Patient blocked');
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await activatePatient(id, req.user!.userId);
    await logAudit(req, 'ACTIVATE', 'Patient', id);
    sendSuccess(res, patient, 'Patient activated');
  } catch (err) { next(err); }
});

router.post('/:id/impersonate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await prisma.patient.findUnique({ where: { id }, include: { user: true } });
    if (!patient) throw new AppError('Patient not found', 404);

    const accessToken = signAccessToken({
      userId: patient.userId,
      email: patient.user.email,
      role: 'PATIENT',
    });
    const refreshToken = signRefreshToken({ userId: patient.userId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: patient.userId, expiresAt } });
    await logAudit(req, 'IMPERSONATE', 'Patient', id, { targetEmail: patient.user.email });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: { id: patient.user.id, email: patient.user.email, role: patient.user.role },
      redirectTo: '/patient',
    }, 'Impersonation token issued');
  } catch (err) { next(err); }
});

export default router;
