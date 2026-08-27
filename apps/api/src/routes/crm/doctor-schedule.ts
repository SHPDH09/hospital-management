import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logCrmAudit } from '../../lib/crm-audit';
import { requireOrgId, assertOrgAdmin } from '../../lib/crm-tenant';
import { buildSlotTimes, generateSlotsFromWeeklySchedule } from '../../lib/doctor-schedule';

const router = Router();

async function requireOrgDoctor(doctorId: string, orgId: string) {
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, organizationId: orgId } });
  if (!doctor) throw new AppError('Doctor not found', 404);
  return doctor;
}

const weeklyEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  slotMinutes: z.number().int().min(5).max(180).default(30),
  isActive: z.boolean().default(true),
});

router.get('/doctors/:doctorId/weekly-schedule', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const doctorId = paramId(req.params.doctorId);
    await requireOrgDoctor(doctorId, orgId);
    const schedules = await prisma.doctorWeeklySchedule.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    sendSuccess(res, schedules);
  } catch (err) { next(err); }
});

router.put('/doctors/:doctorId/weekly-schedule', validateBody(z.object({
  entries: z.array(weeklyEntrySchema),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const doctorId = paramId(req.params.doctorId);
    await requireOrgDoctor(doctorId, orgId);

    for (const entry of req.body.entries) {
      if (buildSlotTimes(entry.startTime, entry.endTime, entry.slotMinutes).length === 0) {
        throw new AppError(`Invalid time range for day ${entry.dayOfWeek}`, 400);
      }
    }

    const schedules = await prisma.$transaction(async (tx) => {
      await tx.doctorWeeklySchedule.deleteMany({ where: { doctorId } });
      if (req.body.entries.length === 0) return [];
      await tx.doctorWeeklySchedule.createMany({
        data: req.body.entries.map((e: z.infer<typeof weeklyEntrySchema>) => ({ ...e, doctorId })),
      });
      return tx.doctorWeeklySchedule.findMany({
        where: { doctorId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });

    await logCrmAudit(req, orgId, 'UPDATE', 'DoctorWeeklySchedule', doctorId, { entries: req.body.entries.length });
    sendSuccess(res, schedules, 'Weekly schedule saved');
  } catch (err) { next(err); }
});

router.post('/doctors/:doctorId/generate-slots', validateBody(z.object({
  fromDate: z.string(),
  toDate: z.string(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const doctorId = paramId(req.params.doctorId);
    await requireOrgDoctor(doctorId, orgId);

    const fromDate = new Date(req.body.fromDate);
    const toDate = new Date(req.body.toDate);
    if (toDate < fromDate) throw new AppError('toDate must be on or after fromDate', 400);

    const maxDays = 90;
    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > maxDays) throw new AppError(`Date range cannot exceed ${maxDays} days`, 400);

    const result = await generateSlotsFromWeeklySchedule({ doctorId, fromDate, toDate });
    await logCrmAudit(req, orgId, 'CREATE', 'AppointmentSlot', doctorId, result);
    sendSuccess(res, result, `Generated ${result.created} slots (${result.skipped} skipped)`);
  } catch (err) { next(err); }
});

router.delete('/slots/:id', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id },
      include: { doctor: { select: { organizationId: true } } },
    });
    if (!slot || slot.doctor.organizationId !== orgId) throw new AppError('Slot not found', 404);
    if (slot.isBooked) throw new AppError('Cannot delete a booked slot', 409);
    await prisma.appointmentSlot.delete({ where: { id } });
    await logCrmAudit(req, orgId, 'DELETE', 'AppointmentSlot', id);
    sendSuccess(res, null, 'Slot deleted');
  } catch (err) { next(err); }
});

router.get('/doctors/:doctorId/leaves', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const doctorId = paramId(req.params.doctorId);
    await requireOrgDoctor(doctorId, orgId);
    const leaves = await prisma.doctorLeave.findMany({
      where: { doctorId },
      orderBy: { startDate: 'desc' },
    });
    sendSuccess(res, leaves);
  } catch (err) { next(err); }
});

router.get('/leaves', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const leaves = await prisma.doctorLeave.findMany({
      where: { organizationId: orgId, ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}) },
      include: { doctor: { select: { id: true, fullName: true, specialization: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, leaves);
  } catch (err) { next(err); }
});

router.post('/doctors/:doctorId/leaves', validateBody(z.object({
  startDate: z.string(),
  endDate: z.string(),
  type: z.enum(['SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER']).default('CASUAL'),
  reason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const doctorId = paramId(req.params.doctorId);
    const doctor = await requireOrgDoctor(doctorId, orgId);

    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (endDate < startDate) throw new AppError('endDate must be on or after startDate', 400);

    const isDoctorSelf = req.user?.role === 'DOCTOR' && doctor.userId === req.user.userId;
    if (!isDoctorSelf) assertOrgAdmin(req);

    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId,
        organizationId: orgId,
        startDate,
        endDate,
        type: req.body.type,
        reason: req.body.reason,
        status: isDoctorSelf ? 'PENDING' : 'APPROVED',
        approvedById: isDoctorSelf ? undefined : req.user?.userId,
      },
    });
    await logCrmAudit(req, orgId, 'CREATE', 'DoctorLeave', leave.id, req.body);
    sendSuccess(res, leave, 'Leave request created', 201);
  } catch (err) { next(err); }
});

router.patch('/leaves/:id', validateBody(z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER']).optional(),
  reason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const existing = await prisma.doctorLeave.findFirst({
      where: { id, organizationId: orgId },
      include: { doctor: { select: { userId: true } } },
    });
    if (!existing) throw new AppError('Leave not found', 404);

    const isDoctorSelf = req.user?.role === 'DOCTOR' && existing.doctor.userId === req.user.userId;
    if (req.body.status && ['APPROVED', 'REJECTED'].includes(req.body.status)) {
      assertOrgAdmin(req);
    } else if (!isDoctorSelf) {
      assertOrgAdmin(req);
    } else if (req.body.status && req.body.status !== 'CANCELLED') {
      throw new AppError('Doctors can only cancel their own leave requests', 403);
    }

    const data: Record<string, unknown> = { ...req.body };
    if (req.body.startDate) data.startDate = new Date(req.body.startDate);
    if (req.body.endDate) data.endDate = new Date(req.body.endDate);
    if (req.body.status === 'APPROVED' || req.body.status === 'REJECTED') {
      data.approvedById = req.user?.userId;
    }

    const leave = await prisma.doctorLeave.update({ where: { id }, data });
    await logCrmAudit(req, orgId, 'UPDATE', 'DoctorLeave', id, req.body);
    sendSuccess(res, leave, 'Leave updated');
  } catch (err) { next(err); }
});

router.patch('/doctors/:doctorId/verification', validateBody(z.object({
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const doctorId = paramId(req.params.doctorId);
    await requireOrgDoctor(doctorId, orgId);
    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: { verificationStatus: req.body.verificationStatus },
    });
    await logCrmAudit(req, orgId, 'UPDATE', 'Doctor', doctorId, req.body);
    sendSuccess(res, doctor, 'Verification status updated');
  } catch (err) { next(err); }
});

export default router;
