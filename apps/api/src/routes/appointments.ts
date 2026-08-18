import { Router } from 'express';
import { z } from 'zod';
import { prisma, TransactionClient } from '../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, resolveOrganizationId } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const bookAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  organizationId: z.string().uuid(),
  appointmentDate: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  type: z.string().default('consultation'),
  notes: z.string().optional(),
  slotId: z.string().uuid().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
});

router.post('/book', authenticate, requireRoles('PATIENT'), validateBody(bookAppointmentSchema), async (req: AuthRequest, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) throw new AppError('Patient profile not found', 404);

    const data = req.body;
    const doctor = await prisma.doctor.findFirst({
      where: { id: data.doctorId, organizationId: data.organizationId, isActive: true },
    });
    if (!doctor) throw new AppError('Doctor not found', 404);

    const appointment = await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.patientOrganization.upsert({
        where: {
          patientId_organizationId: { patientId: patient.id, organizationId: data.organizationId },
        },
        create: { patientId: patient.id, organizationId: data.organizationId },
        update: {},
      });

      if (data.slotId) {
        const slot = await tx.appointmentSlot.findFirst({
          where: { id: data.slotId, doctorId: data.doctorId, isBooked: false },
        });
        if (!slot) throw new AppError('Slot not available', 409);
        await tx.appointmentSlot.update({ where: { id: data.slotId }, data: { isBooked: true } });
      }

      return tx.appointment.create({
        data: {
          organizationId: data.organizationId,
          branchId: doctor.branchId,
          patientId: patient.id,
          doctorId: data.doctorId,
          departmentId: doctor.departmentId,
          slotId: data.slotId,
          appointmentDate: new Date(data.appointmentDate),
          startTime: data.startTime,
          endTime: data.endTime,
          type: data.type,
          notes: data.notes,
          status: 'PENDING',
        },
        include: {
          doctor: { select: { fullName: true, specialization: true } },
          organization: { select: { name: true, address: true } },
        },
      });
    });

    sendSuccess(res, appointment, 'Appointment booked', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/my', authenticate, requireRoles('PATIENT'), async (req: AuthRequest, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) throw new AppError('Patient profile not found', 404);

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const where = {
      patientId: patient.id,
      ...(status && { status: status as never }),
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        include: {
          doctor: { select: { id: true, fullName: true, specialization: true, photoUrl: true } },
          organization: { select: { id: true, name: true, slug: true, address: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    sendPaginated(res, appointments, { page, limit, total });
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
    const status = req.query.status as string | undefined;
    const date = req.query.date as string | undefined;

    let where: Record<string, unknown> = {};
    if (orgId) where.organizationId = orgId;
    if (status) where.status = status;
    if (date) where.appointmentDate = new Date(date);

    if (req.user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.userId } });
      if (doctor) where.doctorId = doctor.id;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
        include: {
          patient: { select: { id: true, fullName: true, user: { select: { phone: true } } } },
          doctor: { select: { id: true, fullName: true, specialization: true } },
          organization: { select: { name: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    sendPaginated(res, appointments, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', authenticate, requireRoles(...CRM_ROLES), validateBody(updateStatusSchema), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orgId = await resolveOrganizationId(req);
    const appointment = await prisma.appointment.findFirst({
      where: { id, ...(orgId && { organizationId: orgId }) },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: req.body.status },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
      },
    });

    if (req.body.status === 'COMPLETED') {
      const { processTreatmentCommission } = await import('../lib/referral-service');
      await processTreatmentCommission(id).catch(() => undefined);
    }

    sendSuccess(res, updated, 'Status updated');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        organization: true,
        department: true,
        bills: true,
      },
    });

    if (!appointment) throw new AppError('Appointment not found', 404);

    if (req.user!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
      if (patient?.id !== appointment.patientId) throw new AppError('Access denied', 403);
    }

    sendSuccess(res, appointment);
  } catch (err) {
    next(err);
  }
});

export default router;
