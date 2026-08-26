import { Router } from 'express';
import { z } from 'zod';
import { LeadStatus } from '@prisma/client';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  getLeadManagementDashboard,
  listLeads,
  getLeadOverview,
  detectDuplicateLeads,
  assignLead,
  updateLeadStatus,
  addLeadNote,
  scheduleFollowUp,
  completeFollowUp,
  convertLeadToPatient,
  markLeadLost,
  getTodayFollowUps,
  leadsToCsv,
} from '../../lib/lead-management';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

const statusEnum = z.enum([
  'NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'FOLLOW_UP', 'APPOINTMENT_BOOKED',
  'VISITED', 'TREATMENT_STARTED', 'CONVERTED', 'NOT_INTERESTED', 'WRONG_NUMBER',
  'DUPLICATE', 'LOST', 'INVALID',
]);

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await getLeadManagementDashboard());
  } catch (err) { next(err); }
});

router.get('/follow-ups/today', async (_req, res, next) => {
  try {
    sendSuccess(res, await getTodayFollowUps());
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { leads } = await listLeads({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      source: req.query.source as string | undefined,
      limit: 5000,
      page: 1,
    });
    const csv = leadsToCsv(leads as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await listLeads({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      source: req.query.source as string | undefined,
      priority: req.query.priority as string | undefined,
      temperature: req.query.temperature as string | undefined,
      organizationId: req.query.organizationId as string | undefined,
      assignedToId: req.query.assignedToId as string | undefined,
      unassigned: req.query.unassigned === 'true',
      city: req.query.city as string | undefined,
      state: req.query.state as string | undefined,
      campaign: req.query.campaign as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    sendPaginated(res, result.leads, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const overview = await getLeadOverview(id);
    if (!overview) throw new AppError('Lead not found', 404);
    sendSuccess(res, overview);
  } catch (err) { next(err); }
});

router.get('/:id/duplicates', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const lead = await getLeadOverview(id);
    if (!lead) throw new AppError('Lead not found', 404);
    const duplicates = await detectDuplicateLeads(
      lead.lead.phone || undefined,
      lead.lead.email || undefined,
      id,
    );
    sendSuccess(res, duplicates);
  } catch (err) { next(err); }
});

router.post('/:id/assign', validateBody(z.object({ assignedToId: z.string().uuid() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const lead = await assignLead(id, req.body.assignedToId, req.user!.userId);
    await logAudit(req, 'ASSIGN', 'Lead', id, req.body);
    sendSuccess(res, lead, 'Lead assigned');
  } catch (err) { next(err); }
});

router.patch('/:id/status', validateBody(z.object({
  status: statusEnum,
  notes: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const lead = await updateLeadStatus(id, req.body.status as LeadStatus, req.user!.userId, req.body.notes);
    await logAudit(req, 'STATUS_CHANGE', 'Lead', id, req.body);
    sendSuccess(res, lead, 'Status updated');
  } catch (err) { next(err); }
});

router.post('/:id/notes', validateBody(z.object({ notes: z.string().min(1) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const lead = await addLeadNote(id, req.body.notes, req.user!.userId);
    sendSuccess(res, lead, 'Note added');
  } catch (err) { next(err); }
});

router.post('/:id/follow-up', validateBody(z.object({
  scheduledAt: z.string(),
  reason: z.string().min(3),
  assignedToId: z.string().uuid().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const followUp = await scheduleFollowUp(
      id,
      new Date(req.body.scheduledAt),
      req.body.reason,
      req.body.assignedToId,
      req.user!.userId,
    );
    sendSuccess(res, followUp, 'Follow-up scheduled', 201);
  } catch (err) { next(err); }
});

router.post('/:id/convert', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const result = await convertLeadToPatient(id, req.user!.userId);
    await logAudit(req, 'CONVERT', 'Lead', id);
    sendSuccess(res, result, 'Lead converted');
  } catch (err) { next(err); }
});

router.post('/:id/lost', validateBody(z.object({ lostReason: z.string().min(3) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const lead = await markLeadLost(id, req.body.lostReason, req.user!.userId);
    await logAudit(req, 'LOST', 'Lead', id, req.body);
    sendSuccess(res, lead, 'Lead marked as lost');
  } catch (err) { next(err); }
});

router.post('/follow-ups/:followUpId/complete', validateBody(z.object({ notes: z.string().optional() })), async (req: AuthRequest, res, next) => {
  try {
    const followUpId = paramId(req.params.followUpId);
    const followUp = await completeFollowUp(followUpId, req.body.notes, req.user!.userId);
    sendSuccess(res, followUp, 'Follow-up completed');
  } catch (err) { next(err); }
});

router.post('/:id/score', async (req: AuthRequest, res, next) => {
  try {
    const { scoreLead } = await import('../../services/leads/lead-scoring');
    const result = await scoreLead(paramId(req.params.id), req.user!.userId);
    sendSuccess(res, result, 'Lead scored');
  } catch (err) { next(err); }
});

export default router;
