import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  getClinicManagementDashboard,
  listClinics,
  getClinicOverview,
  suspendClinic,
  activateClinic,
  clinicsToCsv,
} from '../../lib/organization-management';
import { requestReVerification } from '../../lib/verification-service';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getClinicManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { clinics } = await listClinics({
      search: req.query.search as string | undefined,
      state: req.query.state as string | undefined,
      city: req.query.city as string | undefined,
      verificationStatus: req.query.verificationStatus as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = clinicsToCsv(clinics as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=clinics.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await listClinics({
      search: req.query.search as string | undefined,
      state: req.query.state as string | undefined,
      city: req.query.city as string | undefined,
      verificationStatus: req.query.verificationStatus as string | undefined,
      subscriptionStatus: req.query.subscriptionStatus as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      accountActivated: req.query.accountActivated === 'true' ? true : req.query.accountActivated === 'false' ? false : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.clinics, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getClinicOverview(id);
    if (!overview) throw new AppError('Clinic not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.get('/:id/doctors', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctors = await prisma.doctor.findMany({
      where: { organizationId: id },
      include: { department: true, branch: true, user: { select: { email: true, isActive: true } } },
      orderBy: { fullName: 'asc' },
    });
    sendSuccess(res, doctors);
  } catch (err) { next(err); }
});

router.get('/:id/staff', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const staff = await prisma.staff.findMany({
      where: { organizationId: id },
      include: { branch: true, user: { select: { email: true, isActive: true, phone: true } } },
      orderBy: { fullName: 'asc' },
    });
    sendSuccess(res, staff);
  } catch (err) { next(err); }
});

router.get('/:id/patients', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [links, total] = await Promise.all([
      prisma.patientOrganization.findMany({
        where: { organizationId: id },
        skip,
        take: limit,
        include: {
          patient: {
            include: {
              user: { select: { email: true, phone: true } },
              _count: { select: { appointments: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patientOrganization.count({ where: { organizationId: id } }),
    ]);
    sendPaginated(res, links, { page, limit, total });
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
        where: { organizationId: id, ...(status && { status: status as never }) },
        skip,
        take: limit,
        orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true, specialization: true } },
          branch: { select: { name: true } },
        },
      }),
      prisma.appointment.count({ where: { organizationId: id, ...(status && { status: status as never }) } }),
    ]);
    sendPaginated(res, appointments, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/:id/referrals', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const connections = await prisma.referralHospitalConnection.findMany({
      where: { organizationId: id },
      include: {
        ashaProfile: { select: { ashaName: true, ashaId: true, status: true } },
        referralPartner: { select: { referralPartnerName: true, referralId: true, status: true } },
      },
      orderBy: { connectionDate: 'desc' },
    });
    const attributions = await prisma.patientReferralAttribution.count({ where: { organizationId: id } });
    const commissions = await prisma.referralCommission.aggregate({
      where: { organizationId: id },
      _sum: { commissionAmount: true },
      _count: true,
    });
    sendSuccess(res, { connections, attributions, commissions });
  } catch (err) { next(err); }
});

router.get('/:id/advertisements', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ads = await prisma.advertisement.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, ads);
  } catch (err) { next(err); }
});

router.get('/:id/audit-logs', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const logs = await prisma.organizationAuditLog.findMany({
      where: { organizationId: id },
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
    const org = await prisma.organization.update({ where: { id, type: 'CLINIC' }, data: req.body });
    await logAudit(req, 'UPDATE', 'Clinic', id, req.body);
    sendSuccess(res, org, 'Clinic profile updated');
  } catch (err) { next(err); }
});

router.post('/:id/suspend', validateBody(z.object({
  reason: z.string().min(5),
  suspendLogin: z.boolean().optional(),
  hideFromSearch: z.boolean().optional(),
  stopNewAppointments: z.boolean().optional(),
  stopAdvertisements: z.boolean().optional(),
  stopNewRegistrations: z.boolean().optional(),
  suspendCrmAccess: z.boolean().optional(),
  fullSuspension: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const org = await suspendClinic(id, req.body, req.user!.userId);
    await logAudit(req, 'SUSPEND', 'Clinic', id, req.body);
    sendSuccess(res, org, 'Clinic suspended');
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const org = await activateClinic(id, req.user!.userId);
    await logAudit(req, 'ACTIVATE', 'Clinic', id);
    sendSuccess(res, org, 'Clinic activated');
  } catch (err) { next(err); }
});

router.post('/:id/re-verify', validateBody(z.object({ reason: z.string().min(5) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const app = await requestReVerification(id, req.body.reason, req.user!.userId);
    await logAudit(req, 'RE_VERIFY', 'Clinic', id, req.body);
    sendSuccess(res, app, 'Re-verification triggered');
  } catch (err) { next(err); }
});

export default router;
