import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken, signRefreshToken } from '../../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import subscriptionRoutes from './subscriptions';
import couponRoutes from './coupons';
import locationRoutes from './locations';
import masterDataRoutes from './master-data';
import settingsRoutes from './settings';
import emergencyRoutes from './emergency';
import communicationsRoutes from './communications';
import supportRoutes from './support';
import cmsRoutes from './cms';
import permissionsRoutes from './permissions';
import platformStaffRoutes from './platform-staff';
import advertisementRoutes from './advertisements';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));
router.use('/subscriptions', subscriptionRoutes);
router.use('/coupons', couponRoutes);
router.use('/locations', locationRoutes);
router.use('/master-data', masterDataRoutes);
router.use('/settings', settingsRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/communications', communicationsRoutes);
router.use('/support', supportRoutes);
router.use('/cms', cmsRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/platform-staff', platformStaffRoutes);
router.use('/advertisements', advertisementRoutes);

// ─── Dashboard & Analytics ───────────────────────────────────────────────────

router.get('/stats', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalHospitals, totalClinics, totalDoctors, totalPatients, totalStaff,
      todayAppointments, monthlyAppointments, pendingPayments, activeSubscriptions,
      expiredSubscriptions, pendingApprovals, totalComplaints, newRegistrations,
      revenueAgg, subscriptionRevenue, adRevenue,
    ] = await Promise.all([
      prisma.organization.count({ where: { type: 'HOSPITAL' } }),
      prisma.organization.count({ where: { type: 'CLINIC' } }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.patient.count(),
      prisma.staff.count(),
      prisma.appointment.count({ where: { appointmentDate: { gte: today } } }),
      prisma.appointment.count({ where: { appointmentDate: { gte: monthStart } } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.organization.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.complaint.count({ where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.organization.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.subscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } }),
      prisma.advertisement.aggregate({ _sum: { budget: true } }),
    ]);

    const subscriptionRevenueTotal = subscriptionRevenue.reduce((s, sub) => s + (sub.plan.price || 0), 0);

    sendSuccess(res, {
      totalHospitals, totalClinics, totalDoctors, totalPatients, totalStaff,
      todayAppointments, monthlyAppointments,
      totalRevenue: revenueAgg._sum.amount || 0,
      subscriptionRevenue: subscriptionRevenueTotal,
      advertisementRevenue: adRevenue._sum.budget || 0,
      pendingPayments, activeSubscriptions, expiredSubscriptions,
      newRegistrations, pendingApprovals, complaints: totalComplaints,
    });
  } catch (err) { next(err); }
});

router.get('/analytics/growth', async (_req, res, next) => {
  try {
    const months: { month: string; organizations: number; patients: number; appointments: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const [orgs, patients, appointments] = await Promise.all([
        prisma.organization.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.patient.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.appointment.count({ where: { createdAt: { gte: start, lt: end } } }),
      ]);
      months.push({ month: start.toLocaleString('en', { month: 'short' }), organizations: orgs, patients, appointments });
    }
    sendSuccess(res, months);
  } catch (err) { next(err); }
});

// ─── Organizations (Hospitals / Clinics) ─────────────────────────────────────

router.get('/organizations', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where = {
      ...(type && { type: type as never }),
      ...(status && { verificationStatus: status as never }),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { city: { contains: search, mode: 'insensitive' as const } }] }),
    };

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { doctors: true, staff: true, appointments: true, patientOrgs: true } },
          subscriptions: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 },
        },
      }),
      prisma.organization.count({ where }),
    ]);
    sendPaginated(res, orgs, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/organizations/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        branches: true, doctors: { include: { user: { select: { email: true, isActive: true } } } },
        staff: { include: { user: { select: { email: true, isActive: true } } } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        documents: true, reviews: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: { select: { appointments: true, bills: true, leads: true, patientOrgs: true } },
      },
    });
    if (!org) throw new AppError('Organization not found', 404);
    sendSuccess(res, org);
  } catch (err) { next(err); }
});

router.patch('/organizations/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const org = await prisma.organization.update({ where: { id }, data: req.body });
    await logAudit(req, 'UPDATE', 'Organization', id, req.body);
    sendSuccess(res, org);
  } catch (err) { next(err); }
});

router.patch('/organizations/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { verificationStatus, isActive, isPubliclyListed } = req.body;
    const org = await prisma.organization.update({
      where: { id },
      data: { verificationStatus, isActive, isPubliclyListed },
    });
    await logAudit(req, 'STATUS_CHANGE', 'Organization', id, { verificationStatus, isActive });
    sendSuccess(res, org);
  } catch (err) { next(err); }
});

router.delete('/organizations/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.organization.delete({ where: { id } });
    await logAudit(req, 'DELETE', 'Organization', id);
    sendSuccess(res, null, 'Organization deleted');
  } catch (err) { next(err); }
});

router.post('/organizations/:id/impersonate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const staff = await prisma.staff.findFirst({
      where: { organizationId: id, role: 'HOSPITAL_ADMIN' },
      include: { user: true },
    });
    if (!staff) throw new AppError('No hospital admin found for this organization', 404);

    const accessToken = signAccessToken({
      userId: staff.userId, email: staff.user.email, role: 'HOSPITAL_ADMIN',
      organizationId: id, branchId: staff.branchId || undefined,
    });
    const refreshToken = signRefreshToken({ userId: staff.userId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: staff.userId, expiresAt } });
    await logAudit(req, 'IMPERSONATE', 'Organization', id, { targetEmail: staff.user.email });

    sendSuccess(res, {
      accessToken, refreshToken,
      user: { id: staff.user.id, email: staff.user.email, role: staff.user.role },
      redirectTo: '/crm',
    }, 'Impersonation token issued');
  } catch (err) { next(err); }
});

// ─── User impersonation (any role except super admin) ───────────────────────

const IMPERSONATION_REDIRECT: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  PLATFORM_STAFF: '/admin',
  HOSPITAL_ADMIN: '/crm',
  BRANCH_ADMIN: '/crm',
  DOCTOR: '/crm',
  RECEPTIONIST: '/crm',
  NURSE: '/crm',
  ACCOUNTANT: '/crm',
  PHARMACIST: '/crm',
  LAB_STAFF: '/crm',
  MANAGER: '/crm',
  PATIENT: '/patient',
};

router.post('/users/:userId/impersonate', async (req: AuthRequest, res, next) => {
  try {
    const userId = paramId(req.params.userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { doctor: true, staff: true },
    });
    if (!user) throw new AppError('User not found', 404);
    if (!user.isActive) throw new AppError('User is blocked', 403);
    if (user.role === 'SUPER_ADMIN') throw new AppError('Cannot impersonate super admin accounts', 403);
    if (req.user?.userId === userId) throw new AppError('Cannot impersonate yourself', 400);

    const organizationId = user.doctor?.organizationId || user.staff?.organizationId || undefined;
    const branchId = user.doctor?.branchId || user.staff?.branchId || undefined;

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role as import('@healthcare/shared').UserRole,
      organizationId,
      branchId,
    });
    const refreshToken = signRefreshToken({ userId: user.id });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });
    await logAudit(req, 'IMPERSONATE', 'User', userId, { targetEmail: user.email, role: user.role });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
      redirectTo: IMPERSONATION_REDIRECT[user.role] || '/',
    }, 'Impersonation token issued');
  } catch (err) { next(err); }
});

// ─── Doctors ─────────────────────────────────────────────────────────────────

router.get('/doctors', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const where = search ? { fullName: { contains: search, mode: 'insensitive' as const } } : {};
    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { organization: { select: { name: true, type: true } }, user: { select: { email: true, isActive: true } }, _count: { select: { appointments: true, reviews: true } } },
      }),
      prisma.doctor.count({ where }),
    ]);
    sendPaginated(res, doctors, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/doctors/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { isActive } = req.body;
    const doctor = await prisma.doctor.update({ where: { id }, data: { isActive } });
    const full = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
    if (full) {
      await prisma.user.update({ where: { id: full.userId }, data: { isActive } });
      if (!isActive) await prisma.refreshToken.deleteMany({ where: { userId: full.userId } });
    }
    await logAudit(req, 'STATUS_CHANGE', 'Doctor', id, { isActive });
    sendSuccess(res, doctor);
  } catch (err) { next(err); }
});

router.patch('/doctors/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { fullName, specialization, qualification, experience, consultationFee, registrationNumber } = req.body;
    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(specialization !== undefined && { specialization }),
        ...(qualification !== undefined && { qualification }),
        ...(experience !== undefined && { experience: Number(experience) }),
        ...(consultationFee !== undefined && { consultationFee: Number(consultationFee) }),
        ...(registrationNumber !== undefined && { registrationNumber }),
      },
    });
    await logAudit(req, 'UPDATE', 'Doctor', id, req.body);
    sendSuccess(res, doctor);
  } catch (err) { next(err); }
});

router.delete('/doctors/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const doctor = await prisma.doctor.findUnique({ where: { id }, select: { userId: true } });
    if (!doctor) throw new AppError('Doctor not found', 404);

    const appointmentCount = await prisma.appointment.count({ where: { doctorId: id } });
    if (appointmentCount > 0) {
      await prisma.user.update({ where: { id: doctor.userId }, data: { isActive: false } });
      await prisma.doctor.update({ where: { id }, data: { isActive: false } });
      await prisma.refreshToken.deleteMany({ where: { userId: doctor.userId } });
      await logAudit(req, 'SOFT_DELETE', 'Doctor', id, { reason: 'Has appointments — deactivated instead' });
      return sendSuccess(res, null, 'Doctor has appointments — account blocked instead of deleted');
    }

    await prisma.refreshToken.deleteMany({ where: { userId: doctor.userId } });
    await prisma.user.delete({ where: { id: doctor.userId } });
    await logAudit(req, 'DELETE', 'Doctor', id);
    sendSuccess(res, null, 'Doctor deleted');
  } catch (err) { next(err); }
});

// ─── Patients ────────────────────────────────────────────────────────────────

router.get('/patients', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const where = search ? { fullName: { contains: search, mode: 'insensitive' as const } } : {};
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, isActive: true, lastLoginAt: true } }, _count: { select: { appointments: true } } },
      }),
      prisma.patient.count({ where }),
    ]);
    sendPaginated(res, patients, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/patients/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new AppError('Patient not found', 404);
    await prisma.user.update({ where: { id: patient.userId }, data: { isActive: req.body.isActive } });
    if (!req.body.isActive) {
      await prisma.refreshToken.deleteMany({ where: { userId: patient.userId } });
    }
    await logAudit(req, 'STATUS_CHANGE', 'Patient', id, req.body);
    sendSuccess(res, { id, isActive: req.body.isActive });
  } catch (err) { next(err); }
});

router.patch('/patients/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await prisma.patient.findUnique({ where: { id }, include: { user: true } });
    if (!patient) throw new AppError('Patient not found', 404);

    const { fullName, city, state, phone, email } = req.body;
    const updated = await prisma.patient.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
      },
    });

    if (phone !== undefined || email !== undefined) {
      await prisma.user.update({
        where: { id: patient.userId },
        data: {
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
        },
      });
    }

    await logAudit(req, 'UPDATE', 'Patient', id, req.body);
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

router.delete('/patients/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const patient = await prisma.patient.findUnique({ where: { id }, select: { userId: true } });
    if (!patient) throw new AppError('Patient not found', 404);

    const appointmentCount = await prisma.appointment.count({ where: { patientId: id } });
    if (appointmentCount > 0) {
      await prisma.user.update({ where: { id: patient.userId }, data: { isActive: false } });
      await prisma.refreshToken.deleteMany({ where: { userId: patient.userId } });
      await logAudit(req, 'SOFT_DELETE', 'Patient', id, { reason: 'Has appointments — blocked instead' });
      return sendSuccess(res, null, 'Patient has appointments — account blocked instead of deleted');
    }

    await prisma.refreshToken.deleteMany({ where: { userId: patient.userId } });
    await prisma.user.delete({ where: { id: patient.userId } });
    await logAudit(req, 'DELETE', 'Patient', id);
    sendSuccess(res, null, 'Patient deleted');
  } catch (err) { next(err); }
});

// ─── Appointments ──────────────────────────────────────────────────────────────

router.get('/appointments', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where, skip, take: limit, orderBy: { appointmentDate: 'desc' },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
          organization: { select: { name: true, type: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);
    sendPaginated(res, appointments, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/appointments/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const apt = await prisma.appointment.update({ where: { id }, data: { status: req.body.status } });
    await logAudit(req, 'STATUS_CHANGE', 'Appointment', id, { status: req.body.status });
    sendSuccess(res, apt);
  } catch (err) { next(err); }
});

// ─── Payments ────────────────────────────────────────────────────────────────

router.get('/payments', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { bill: { include: { patient: { select: { fullName: true } }, organization: { select: { name: true } } } } },
      }),
      prisma.payment.count({ where }),
    ]);
    sendPaginated(res, payments, { page, limit, total });
  } catch (err) { next(err); }
});


// ─── Leads ───────────────────────────────────────────────────────────────────

router.get('/leads', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { organization: { select: { name: true } } } }),
      prisma.lead.count({ where }),
    ]);
    sendPaginated(res, leads, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/leads/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const lead = await prisma.lead.update({ where: { id }, data: req.body });
    await logAudit(req, 'UPDATE', 'Lead', id, req.body);

    const { enqueueJob } = await import('../../services/jobs/queue');
    const { emitAutomationEvent } = await import('../../services/automation/engine');
    enqueueJob('lead_score', { leadId: id }).catch(console.error);
    emitAutomationEvent('lead.status_changed', 'lead', id, {
      status: lead.status,
      temperature: lead.temperature,
      score: lead.score,
    }).catch(console.error);

    sendSuccess(res, lead);
  } catch (err) { next(err); }
});

router.post('/leads/:id/score', async (req: AuthRequest, res, next) => {
  try {
    const { scoreLead } = await import('../../services/leads/lead-scoring');
    const result = await scoreLead(paramId(req.params.id), req.user!.userId);
    sendSuccess(res, result, 'Lead scored');
  } catch (err) { next(err); }
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

router.get('/reviews', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { patient: { select: { fullName: true } }, organization: { select: { name: true } }, doctor: { select: { fullName: true } } },
      }),
      prisma.review.count(),
    ]);
    sendPaginated(res, reviews, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/reviews/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const review = await prisma.review.update({ where: { id }, data: req.body });
    await logAudit(req, 'UPDATE', 'Review', id, req.body);
    sendSuccess(res, review);
  } catch (err) { next(err); }
});

router.post('/reviews/:id/analyze', async (req: AuthRequest, res, next) => {
  try {
    const { analyzeReview } = await import('../../services/reviews/review-analysis');
    const result = await analyzeReview(paramId(req.params.id), req.user!.userId);
    sendSuccess(res, result, 'Review analyzed');
  } catch (err) { next(err); }
});

// Legacy complaints routes (backward compatible)
router.get('/complaints', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never, isArchived: false } : { isArchived: false };
    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { assignedTo: { select: { email: true } }, organization: { select: { name: true } }, category: true },
      }),
      prisma.complaint.count({ where }),
    ]);
    sendPaginated(res, complaints, { page, limit, total });
  } catch (err) { next(err); }
});

router.post('/complaints', validateBody(z.object({
  subject: z.string(), description: z.string(), type: z.string().optional(),
  priority: z.string().optional(), complainantName: z.string().optional(),
  complainantEmail: z.string().optional(), organizationId: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const { generateTicketId } = await import('../../lib/support');
    const ticketId = generateTicketId();
    const complaint = await prisma.complaint.create({ data: { ...req.body, ticketId } });
    sendSuccess(res, complaint, 'Complaint created', 201);
  } catch (err) { next(err); }
});

router.patch('/complaints/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const complaint = await prisma.complaint.update({ where: { id }, data: req.body });
    await logAudit(req, 'UPDATE', 'Complaint', id, req.body);
    sendSuccess(res, complaint);
  } catch (err) { next(err); }
});

// ─── Audit Logs & Security ───────────────────────────────────────────────────

router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true, role: true } } } }),
      prisma.auditLog.count(),
    ]);
    sendPaginated(res, logs, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/security/login-history', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.loginHistory.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true, role: true } } } }),
      prisma.loginHistory.count(),
    ]);
    sendPaginated(res, logs, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/security/sessions', async (_req, res, next) => {
  try {
    const tokens = await prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    const byUser = new Map<string, { userId: string; expiresAt: Date; createdAt: Date; sessionCount: number }>();
    for (const token of tokens) {
      const existing = byUser.get(token.userId);
      if (!existing) {
        byUser.set(token.userId, {
          userId: token.userId,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
          sessionCount: 1,
        });
      } else {
        existing.sessionCount += 1;
        if (token.expiresAt > existing.expiresAt) existing.expiresAt = token.expiresAt;
        if (token.createdAt > existing.createdAt) existing.createdAt = token.createdAt;
      }
    }

    const enriched = await Promise.all(
      Array.from(byUser.values()).map(async (session) => {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { email: true, role: true },
        });
        return { ...session, user };
      })
    );

    sendSuccess(res, enriched);
  } catch (err) { next(err); }
});

router.delete('/security/sessions/:userId', async (req: AuthRequest, res, next) => {
  try {
    const userId = paramId(req.params.userId);
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await logAudit(req, 'FORCE_LOGOUT', 'User', userId);
    sendSuccess(res, null, 'All sessions revoked');
  } catch (err) { next(err); }
});

// ─── Roles (read-only from enum) ─────────────────────────────────────────────

router.get('/roles', async (_req, res, next) => {
  try {
    const roles = [
      { role: 'SUPER_ADMIN', description: 'Full platform access', modules: ['all'] },
      { role: 'PLATFORM_STAFF', description: 'Limited operational access', modules: ['organizations', 'verification', 'support'] },
      { role: 'HOSPITAL_ADMIN', description: 'Hospital CRM full access', modules: ['crm'] },
      { role: 'DOCTOR', description: 'Doctor portal & appointments', modules: ['appointments', 'patients'] },
      { role: 'PATIENT', description: 'Patient portal', modules: ['appointments', 'profile'] },
    ];
    sendSuccess(res, roles);
  } catch (err) { next(err); }
});

export default router;
