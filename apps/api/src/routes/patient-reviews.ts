import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendSuccess, AppError } from '../lib/response';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authenticate, requireRoles('PATIENT'));

router.post('/', validateBody(z.object({
  organizationId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  type: z.enum(['HOSPITAL', 'CLINIC', 'DOCTOR', 'SERVICE', 'APPOINTMENT']).default('HOSPITAL'),
  rating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional(),
  isAnonymous: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) throw new AppError('Patient profile not found', 404);

    let isVerifiedVisit = false;
    if (req.body.appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: req.body.appointmentId, patientId: patient.id, status: 'COMPLETED' },
      });
      if (!appt) throw new AppError('Review eligible only after completed visit', 400);
      isVerifiedVisit = true;
    }

    const review = await prisma.review.create({
      data: {
        patientId: patient.id,
        organizationId: req.body.organizationId,
        doctorId: req.body.doctorId,
        appointmentId: req.body.appointmentId,
        type: req.body.type,
        rating: req.body.rating,
        comment: req.body.comment,
        isAnonymous: req.body.isAnonymous ?? false,
        isVerifiedVisit,
        status: 'PENDING',
        isPublished: false,
        source: 'PLATFORM',
      },
    });

    await prisma.reviewActivity.create({
      data: { reviewId: review.id, userId: req.user!.userId, action: 'SUBMITTED', newStatus: 'PENDING' },
    });

    await logAudit(req, 'CREATE', 'Review', review.id, { rating: req.body.rating });
    sendSuccess(res, review, 'Review submitted for moderation', 201);
  } catch (err) { next(err); }
});

router.get('/eligible', async (req: AuthRequest, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) throw new AppError('Patient profile not found', 404);

    const completed = await prisma.appointment.findMany({
      where: { patientId: patient.id, status: 'COMPLETED' },
      include: {
        organization: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const reviewedApptIds = new Set(
      (await prisma.review.findMany({
        where: { patientId: patient.id, appointmentId: { not: null } },
        select: { appointmentId: true },
      })).map((r) => r.appointmentId).filter(Boolean),
    );

    sendSuccess(res, completed.filter((a) => !reviewedApptIds.has(a.id)));
  } catch (err) { next(err); }
});

export default router;
