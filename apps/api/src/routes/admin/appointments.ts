import { Router } from 'express';
import { z } from 'zod';
import { OrganizationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  getAppointmentManagementDashboard,
  listAppointments,
  getAppointmentOverview,
  updateAppointmentStatus,
  rescheduleAppointment,
  checkInAppointment,
  appointmentsToCsv,
} from '../../lib/appointment-management';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

const statusEnum = z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'REJECTED']);

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getAppointmentManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { appointments } = await listAppointments({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = appointmentsToCsv(appointments as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=appointments.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/today', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = await listAppointments({
      dateFrom: today.toISOString().slice(0, 10),
      dateTo: tomorrow.toISOString().slice(0, 10),
      limit: 100,
      page: 1,
    });
    sendSuccess(res, result.appointments);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const orgType = req.query.organizationType as string | undefined;
    const result = await listAppointments({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      paymentStatus: req.query.paymentStatus as string | undefined,
      organizationId: req.query.organizationId as string | undefined,
      organizationType: orgType === 'HOSPITAL' || orgType === 'CLINIC' ? orgType as OrganizationType : undefined,
      branchId: req.query.branchId as string | undefined,
      doctorId: req.query.doctorId as string | undefined,
      patientId: req.query.patientId as string | undefined,
      referralSource: req.query.referralSource as string | undefined,
      isOnline: req.query.isOnline === 'true' ? true : undefined,
      isEmergency: req.query.isEmergency === 'true' ? true : undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.appointments, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getAppointmentOverview(id);
    if (!overview) throw new AppError('Appointment not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.patch('/:id/status', validateBody(z.object({
  status: statusEnum,
  reason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const apt = await updateAppointmentStatus(id, req.body.status, req.user!.userId, req.body.reason);
    await logAudit(req, 'STATUS_CHANGE', 'Appointment', id, req.body);
    sendSuccess(res, apt);
  } catch (err) { next(err); }
});

router.post('/:id/reschedule', validateBody(z.object({
  appointmentDate: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const apt = await rescheduleAppointment(id, req.body.appointmentDate, req.body.startTime, req.body.endTime, req.user!.userId);
    await logAudit(req, 'RESCHEDULE', 'Appointment', id, req.body);
    sendSuccess(res, apt, 'Appointment rescheduled');
  } catch (err) { next(err); }
});

router.post('/:id/check-in', validateBody(z.object({ tokenNumber: z.string().optional() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const apt = await checkInAppointment(id, req.user!.userId, req.body.tokenNumber);
    await logAudit(req, 'CHECK_IN', 'Appointment', id, req.body);
    sendSuccess(res, apt, 'Patient checked in');
  } catch (err) { next(err); }
});

router.post('/:id/cancel', validateBody(z.object({ reason: z.string().min(3) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const apt = await updateAppointmentStatus(id, 'CANCELLED', req.user!.userId, req.body.reason);
    await logAudit(req, 'CANCEL', 'Appointment', id, req.body);
    sendSuccess(res, apt, 'Appointment cancelled');
  } catch (err) { next(err); }
});

export default router;
