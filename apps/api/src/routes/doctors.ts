import { Router } from 'express';
import { z } from 'zod';
import { prisma, readDb, TransactionClient } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, resolveOrganizationId } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { countDoctorsOnLeaveToday } from '../lib/doctor-schedule';

const router = Router();

const searchQuerySchema = z.object({
  query: z.string().optional(),
  specialty: z.string().optional(),
  city: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

const createDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.number().optional(),
  registrationNumber: z.string().optional(),
  consultationFee: z.number().min(0).default(0),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  bio: z.string().optional(),
  languages: z.array(z.string()).optional(),
});

router.get('/search', validateQuery(searchQuerySchema), async (req, res, next) => {
  try {
    const { query, specialty, city, organizationId, page, limit } = req.query as unknown as z.infer<typeof searchQuerySchema>;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      organization: {
        verificationStatus: 'APPROVED' as const,
        isActive: true,
        isPubliclyListed: true,
        ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      },
      ...(organizationId && { organizationId }),
      ...(specialty && { specialization: { contains: specialty, mode: 'insensitive' as const } }),
      ...(query && {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' as const } },
          { specialization: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
    };

    const db = readDb();
    const [doctors, total] = await Promise.all([
      db.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { fullName: 'asc' }],
        include: {
          organization: { select: { id: true, name: true, slug: true, city: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      db.doctor.count({ where }),
    ]);

    sendPaginated(res, doctors, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

// Doctor dashboard statistics for the caller's organization.
router.get('/stats', authenticate, requireRoles(...CRM_ROLES, 'SUPER_ADMIN', 'PLATFORM_STAFF'), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    const docWhere = orgId ? { organizationId: orgId } : {};
    const apptWhere = orgId ? { organizationId: orgId } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalDoctors, activeDoctors, pendingVerification, onLeave, ratingAgg,
      totalAppointments, completed, cancelled, noShow, todayAppointments, totalPatients,
    ] = await Promise.all([
      prisma.doctor.count({ where: docWhere }),
      prisma.doctor.count({ where: { ...docWhere, isActive: true } }),
      prisma.doctor.count({ where: { ...docWhere, verificationStatus: 'PENDING' } }),
      countDoctorsOnLeaveToday(orgId || undefined),
      prisma.doctor.aggregate({ where: docWhere, _avg: { averageRating: true } }),
      prisma.appointment.count({ where: apptWhere }),
      prisma.appointment.count({ where: { ...apptWhere, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { ...apptWhere, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { ...apptWhere, status: 'NO_SHOW' } }),
      prisma.appointment.count({ where: { ...apptWhere, appointmentDate: { gte: today, lt: tomorrow } } }),
      orgId ? prisma.patientOrganization.count({ where: { organizationId: orgId } }) : prisma.patient.count(),
    ]);

    const availableToday = Math.max(0, activeDoctors - onLeave);

    sendSuccess(res, {
      totalDoctors,
      activeDoctors,
      inactiveDoctors: totalDoctors - activeDoctors,
      pendingVerification,
      onLeave,
      availableToday,
      totalAppointments,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      averageRating: Number((ratingAgg._avg.averageRating || 0).toFixed(2)),
      totalPatients,
      todayAppointments,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, city: true, address: true },
        },
        department: true,
        slots: {
          where: { isBooked: false, date: { gte: new Date() } },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: 30,
        },
        reviews: {
          where: { isPublished: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { patient: { select: { fullName: true } } },
        },
      },
    });

    if (!doctor || !doctor.isActive) throw new AppError('Doctor not found', 404);
    sendSuccess(res, doctor);
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, requireRoles(...CRM_ROLES, 'SUPER_ADMIN', 'PLATFORM_STAFF'), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const where = orgId ? { organizationId: orgId } : {};

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        include: {
          department: true,
          branch: true,
          _count: { select: { appointments: true } },
        },
      }),
      prisma.doctor.count({ where }),
    ]);

    sendPaginated(res, doctors, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRoles('HOSPITAL_ADMIN', 'BRANCH_ADMIN'), validateBody(createDoctorSchema), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    if (!orgId) throw new AppError('Organization context required', 400);

    const data = req.body;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await hashPassword(data.password);

    const doctor = await prisma.$transaction(async (tx: TransactionClient) => {
      const user = await tx.user.create({
        data: { email: data.email, passwordHash, role: 'DOCTOR' },
      });

      return tx.doctor.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          branchId: data.branchId,
          departmentId: data.departmentId,
          fullName: data.fullName,
          specialization: data.specialization,
          qualification: data.qualification,
          experience: data.experience,
          registrationNumber: data.registrationNumber,
          consultationFee: data.consultationFee,
          bio: data.bio,
          languages: data.languages || [],
        },
        include: { department: true, branch: true },
      });
    });

    sendSuccess(res, doctor, 'Doctor created', 201);
  } catch (err) {
    next(err);
  }
});

// Full doctor profile (org-scoped) for the CRM: doctor details, aggregate
// stats, recent appointments, connected patients and reviews.
router.get('/:id/profile', authenticate, requireRoles(...CRM_ROLES, 'SUPER_ADMIN', 'PLATFORM_STAFF'), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orgId = await resolveOrganizationId(req);
    const doctor = await prisma.doctor.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
        include: {
          department: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, city: true } },
          user: { select: { email: true, phone: true, isActive: true, lastLoginAt: true } },
          weeklySchedules: { where: { isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
          leaves: {
            where: { status: { in: ['PENDING', 'APPROVED'] } },
            orderBy: { startDate: 'desc' },
            take: 10,
          },
        },
    });
    if (!doctor) throw new AppError('Doctor not found', 404);

    const [total, completed, cancelled, noShow, reviewsCount, recentAppointments, reviews, apptForPatients] = await Promise.all([
      prisma.appointment.count({ where: { doctorId: id } }),
      prisma.appointment.count({ where: { doctorId: id, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { doctorId: id, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { doctorId: id, status: 'NO_SHOW' } }),
      prisma.review.count({ where: { doctorId: id } }),
      prisma.appointment.findMany({
        where: { doctorId: id }, take: 15, orderBy: { appointmentDate: 'desc' },
        include: { patient: { select: { id: true, fullName: true } } },
      }),
      prisma.review.findMany({
        where: { doctorId: id }, take: 10, orderBy: { createdAt: 'desc' },
        include: { patient: { select: { fullName: true } } },
      }),
      prisma.appointment.findMany({
        where: { doctorId: id }, orderBy: { appointmentDate: 'desc' },
        include: { patient: { select: { id: true, fullName: true } } },
      }),
    ]);

    const patientMap = new Map<string, { id: string; fullName: string; visits: number; lastVisit: Date }>();
    for (const a of apptForPatients) {
      if (!a.patient) continue;
      const existing = patientMap.get(a.patient.id);
      if (existing) existing.visits += 1;
      else patientMap.set(a.patient.id, { id: a.patient.id, fullName: a.patient.fullName, visits: 1, lastVisit: a.appointmentDate });
    }

    sendSuccess(res, {
      doctor,
      stats: {
        totalAppointments: total, completedAppointments: completed, cancelledAppointments: cancelled,
        noShowAppointments: noShow, reviews: reviewsCount, patients: patientMap.size, averageRating: doctor.averageRating,
      },
      recentAppointments,
      reviews,
      patients: Array.from(patientMap.values()),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticate, requireRoles('HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR'), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orgId = await resolveOrganizationId(req);
    const doctor = await prisma.doctor.findFirst({
      where: { id, ...(orgId && { organizationId: orgId }) },
    });
    if (!doctor) throw new AppError('Doctor not found', 404);

    if (req.user!.role === 'DOCTOR' && doctor.userId !== req.user!.userId) {
      throw new AppError('Insufficient permissions', 403);
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: req.body,
      include: { department: true },
    });

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
