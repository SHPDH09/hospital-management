import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, PLATFORM_ROLES, resolveOrganizationId } from '../middleware/auth';

const router = Router();

router.get('/crm', authenticate, requireRoles(...CRM_ROLES), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    if (!orgId) return sendSuccess(res, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalPatients,
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      activeDoctors,
      staffCount,
      newPatientsThisMonth,
      monthlyRevenue,
      pendingPayments,
      recentAppointments,
    ] = await Promise.all([
      prisma.patientOrganization.count({ where: { organizationId: orgId } }),
      prisma.appointment.count({
        where: { organizationId: orgId, appointmentDate: { gte: today, lt: tomorrow } },
      }),
      prisma.appointment.count({
        where: {
          organizationId: orgId,
          appointmentDate: { gte: today },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      }),
      prisma.appointment.count({
        where: { organizationId: orgId, status: 'COMPLETED' },
      }),
      prisma.doctor.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.staff.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.patientOrganization.count({
        where: { organizationId: orgId, createdAt: { gte: startOfMonth } },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          bill: { organizationId: orgId, createdAt: { gte: startOfMonth } },
        },
        _sum: { amount: true },
      }),
      prisma.bill.aggregate({
        where: { organizationId: orgId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        _sum: { total: true },
      }),
      prisma.appointment.findMany({
        where: { organizationId: orgId, appointmentDate: { gte: today, lt: tomorrow } },
        take: 10,
        orderBy: { startTime: 'asc' },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      }),
    ]);

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } } },
    });

    sendSuccess(res, {
      stats: {
        totalPatients,
        todayAppointments,
        upcomingAppointments,
        completedAppointments,
        activeDoctors,
        staffCount,
        newPatientsThisMonth,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        pendingPayments: pendingPayments._sum.total || 0,
      },
      subscription: subscription ? {
        status: subscription.status,
        planName: subscription.plan.name,
        endDate: subscription.endDate,
        suspendReason: subscription.suspendReason,
        isRestricted: subscription.status === 'SUSPENDED' || subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED',
      } : null,
      recentAppointments,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/patient', authenticate, requireRoles('PATIENT'), async (req: AuthRequest, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) return sendSuccess(res, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [upcomingAppointments, recentAppointments, pendingBills, recentPrescriptions] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          patientId: patient.id,
          appointmentDate: { gte: today },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        take: 5,
        orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
        include: {
          doctor: { select: { fullName: true, specialization: true } },
          organization: { select: { name: true } },
        },
      }),
      prisma.appointment.findMany({
        where: { patientId: patient.id, status: 'COMPLETED' },
        take: 5,
        orderBy: { appointmentDate: 'desc' },
        include: { doctor: { select: { fullName: true } } },
      }),
      prisma.bill.findMany({
        where: { patientId: patient.id, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        take: 5,
        include: { organization: { select: { name: true } } },
      }),
      [],
    ]);

    sendSuccess(res, {
      upcomingAppointments,
      recentAppointments,
      pendingBills,
      recentPrescriptions,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin', authenticate, requireRoles(...PLATFORM_ROLES), async (_req, res, next) => {
  try {
    const [
      totalOrganizations,
      totalHospitals,
      totalClinics,
      totalDoctors,
      totalPatients,
      totalAppointments,
      pendingVerification,
      activeSubscriptions,
      activeAds,
      recentRegistrations,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { type: 'HOSPITAL' } }),
      prisma.organization.count({ where: { type: 'CLINIC' } }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.organization.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.advertisement.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, type: true, verificationStatus: true, createdAt: true },
      }),
    ]);

    sendSuccess(res, {
      stats: {
        totalOrganizations,
        totalHospitals,
        totalClinics,
        totalDoctors,
        totalPatients,
        totalAppointments,
        pendingVerification,
        activeSubscriptions,
        activeAds,
      },
      recentRegistrations,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
