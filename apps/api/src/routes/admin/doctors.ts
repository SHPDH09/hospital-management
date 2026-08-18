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
  getDoctorManagementDashboard,
  listDoctors,
  getDoctorOverview,
  suspendDoctor,
  activateDoctor,
  requestDoctorReVerification,
  doctorsToCsv,
} from '../../lib/doctor-management';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getDoctorManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { doctors } = await listDoctors({
      search: req.query.search as string | undefined,
      specialization: req.query.specialization as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = doctorsToCsv(doctors as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=doctors.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const orgType = req.query.organizationType as string | undefined;
    const result = await listDoctors({
      search: req.query.search as string | undefined,
      specialization: req.query.specialization as string | undefined,
      qualification: req.query.qualification as string | undefined,
      state: req.query.state as string | undefined,
      city: req.query.city as string | undefined,
      organizationId: req.query.organizationId as string | undefined,
      organizationType: orgType === 'HOSPITAL' || orgType === 'CLINIC' ? orgType as OrganizationType : undefined,
      verificationStatus: req.query.verificationStatus as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      accountActivated: req.query.accountActivated === 'true' ? true : req.query.accountActivated === 'false' ? false : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.doctors, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getDoctorOverview(id);
    if (!overview) throw new AppError('Doctor not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.get('/:id/appointments', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: { doctorId: id, ...(status && { status: status as never }) },
        skip,
        take: limit,
        orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        include: {
          patient: { select: { fullName: true } },
          organization: { select: { name: true, type: true } },
          branch: { select: { name: true } },
        },
      }),
      prisma.appointment.count({ where: { doctorId: id, ...(status && { status: status as never }) } }),
    ]);
    sendPaginated(res, appointments, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/:id/schedule', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const slots = await prisma.appointmentSlot.findMany({
      where: { doctorId: id, date: { gte: new Date() } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 100,
    });
    sendSuccess(res, slots);
  } catch (err) { next(err); }
});

router.get('/:id/reviews', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const reviews = await prisma.review.findMany({
      where: { doctorId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { patient: { select: { fullName: true } }, organization: { select: { name: true } } },
    });
    sendSuccess(res, reviews);
  } catch (err) { next(err); }
});

router.get('/:id/services', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await prisma.doctor.findUnique({ where: { id }, select: { organizationId: true } });
    const services = await prisma.service.findMany({
      where: { organizationId: doctor?.organizationId },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, services);
  } catch (err) { next(err); }
});

router.get('/:id/audit-logs', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
    const logs = await prisma.auditLog.findMany({
      where: { OR: [{ entityType: 'Doctor', entityId: id }, { userId: doctor?.userId }] },
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
    const { verificationStatus: _vs, accountActivated: _aa, ...data } = req.body;
    const doctor = await prisma.doctor.update({ where: { id }, data });
    await logAudit(req, 'UPDATE', 'Doctor', id, data);
    sendSuccess(res, doctor, 'Doctor profile updated');
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { isActive } = req.body;
    const doctor = await prisma.doctor.update({ where: { id }, data: { isActive } });
    await logAudit(req, 'STATUS_CHANGE', 'Doctor', id, { isActive });
    sendSuccess(res, doctor);
  } catch (err) { next(err); }
});

router.post('/:id/suspend', validateBody(z.object({
  reason: z.string().min(5),
  suspendLogin: z.boolean().optional(),
  hidePublicProfile: z.boolean().optional(),
  stopNewAppointments: z.boolean().optional(),
  stopAdvertisements: z.boolean().optional(),
  disableAssociations: z.boolean().optional(),
  fullSuspension: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await suspendDoctor(id, req.body, req.user!.userId);
    await logAudit(req, 'SUSPEND', 'Doctor', id, req.body);
    sendSuccess(res, doctor, 'Doctor suspended');
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await activateDoctor(id, req.user!.userId);
    await logAudit(req, 'ACTIVATE', 'Doctor', id);
    sendSuccess(res, doctor, 'Doctor activated');
  } catch (err) { next(err); }
});

router.post('/:id/re-verify', validateBody(z.object({ reason: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await requestDoctorReVerification(id, req.body.reason, req.user!.userId);
    await logAudit(req, 'RE_VERIFY', 'Doctor', id, req.body);
    sendSuccess(res, doctor, 'Re-verification triggered');
  } catch (err) { next(err); }
});

router.post('/:id/impersonate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { user: true, organization: true },
    });
    if (!doctor) throw new AppError('Doctor not found', 404);

    const accessToken = signAccessToken({
      userId: doctor.userId,
      email: doctor.user.email,
      role: 'DOCTOR',
      organizationId: doctor.organizationId,
      branchId: doctor.branchId || undefined,
    });
    const refreshToken = signRefreshToken({ userId: doctor.userId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: doctor.userId, expiresAt } });
    await logAudit(req, 'IMPERSONATE', 'Doctor', id, { targetEmail: doctor.user.email });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: { id: doctor.user.id, email: doctor.user.email, role: doctor.user.role },
      redirectTo: '/crm',
    }, 'Impersonation token issued');
  } catch (err) { next(err); }
});

export default router;
