import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  generateTicketId,
  computeSlaDue,
  suggestRouting,
  DEFAULT_CATEGORIES,
} from '../../lib/support';

const router = Router();

const ticketInclude = {
  assignedTo: { select: { id: true, email: true, role: true } },
  organization: { select: { id: true, name: true, type: true } },
  category: true,
  user: { select: { id: true, email: true, role: true } },
  _count: { select: { messages: true } },
};

async function logTicketHistory(
  complaintId: string,
  action: string,
  options?: { fromValue?: string; toValue?: string; performedByEmail?: string; details?: Prisma.InputJsonValue },
) {
  await prisma.supportTicketHistory.create({
    data: {
      complaintId,
      action,
      fromValue: options?.fromValue,
      toValue: options?.toValue,
      performedByEmail: options?.performedByEmail,
      details: options?.details,
    },
  });
}

function ticketWhere(req: AuthRequest) {
  const q = req.query;
  const where: Prisma.ComplaintWhereInput = { isArchived: false };
  if (q.status) where.status = q.status as never;
  if (q.priority) where.priority = q.priority as never;
  if (q.kind) where.kind = q.kind as never;
  if (q.categoryId) where.categoryId = q.categoryId as string;
  if (q.assignedToId) where.assignedToId = q.assignedToId as string;
  if (q.department) where.department = q.department as string;
  if (q.complainantType) where.complainantType = q.complainantType as never;
  if (q.search) {
    const s = q.search as string;
    where.OR = [
      { ticketId: { contains: s, mode: 'insensitive' } },
      { subject: { contains: s, mode: 'insensitive' } },
      { complainantName: { contains: s, mode: 'insensitive' } },
      { complainantEmail: { contains: s, mode: 'insensitive' } },
      { complainantPhone: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (q.dateFrom || q.dateTo) {
    where.createdAt = {};
    if (q.dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.dateFrom as string);
    if (q.dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.dateTo as string);
  }
  if (q.my === 'true' && req.user) where.assignedToId = req.user.userId;
  return where;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total, newTickets, open, inProgress, waiting, resolved, closed, escalated,
      highPriority, todayTickets, resolvedToday,
    ] = await Promise.all([
      prisma.complaint.count({ where: { isArchived: false } }),
      prisma.complaint.count({ where: { status: 'NEW', isArchived: false } }),
      prisma.complaint.count({ where: { status: { in: ['OPEN', 'ASSIGNED'] }, isArchived: false } }),
      prisma.complaint.count({ where: { status: 'IN_PROGRESS', isArchived: false } }),
      prisma.complaint.count({ where: { status: 'WAITING_FOR_USER', isArchived: false } }),
      prisma.complaint.count({ where: { status: 'RESOLVED', isArchived: false } }),
      prisma.complaint.count({ where: { status: 'CLOSED', isArchived: false } }),
      prisma.complaint.count({ where: { status: 'ESCALATED', isArchived: false } }),
      prisma.complaint.count({ where: { priority: { in: ['HIGH', 'URGENT', 'CRITICAL'] }, status: { notIn: ['RESOLVED', 'CLOSED'] }, isArchived: false } }),
      prisma.complaint.count({ where: { createdAt: { gte: today }, isArchived: false } }),
      prisma.complaint.count({ where: { resolvedAt: { gte: today }, isArchived: false } }),
    ]);

    const resolvedWithTimes = await prisma.complaint.findMany({
      where: { firstResponseAt: { not: null }, isArchived: false },
      select: { createdAt: true, firstResponseAt: true, resolvedAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    let avgResponseMin = 0;
    let avgResolutionHrs = 0;
    if (resolvedWithTimes.length > 0) {
      const responseTimes = resolvedWithTimes
        .filter((t) => t.firstResponseAt)
        .map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 60000);
      avgResponseMin = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

      const resolutionTimes = resolvedWithTimes
        .filter((t) => t.resolvedAt)
        .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000);
      avgResolutionHrs = resolutionTimes.length ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 10) / 10 : 0;
    }

    const csatAgg = await prisma.complaint.aggregate({
      where: { csatRating: { not: null }, isArchived: false },
      _avg: { csatRating: true },
      _count: { csatRating: true },
    });

    sendSuccess(res, {
      totalTickets: total,
      newTickets,
      openTickets: open,
      inProgress,
      waitingForUser: waiting,
      resolved,
      closed,
      escalated,
      highPriority,
      todayTickets,
      resolvedToday,
      avgResponseMinutes: avgResponseMin,
      avgResolutionHours: avgResolutionHrs,
      customerSatisfaction: csatAgg._avg.csatRating ? Math.round(csatAgg._avg.csatRating * 10) / 10 : null,
      csatCount: csatAgg._count.csatRating,
    });
  } catch (err) { next(err); }
});

// ─── Tickets ─────────────────────────────────────────────────────────────────

router.get('/tickets', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const where = ticketWhere(req as AuthRequest);

    const [tickets, total] = await Promise.all([
      prisma.complaint.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: ticketInclude }),
      prisma.complaint.count({ where }),
    ]);
    sendPaginated(res, tickets, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/tickets/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        messages: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
        transfers: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!ticket) throw new AppError('Ticket not found', 404);
    sendSuccess(res, ticket);
  } catch (err) { next(err); }
});

router.post('/tickets', validateBody(z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['SUPPORT_REQUEST', 'COMPLAINT']).optional(),
  categoryId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  complainantType: z.enum(['PATIENT', 'HOSPITAL', 'DOCTOR', 'PLATFORM_STAFF', 'GUEST']).optional(),
  complainantName: z.string().optional(),
  complainantEmail: z.string().optional(),
  complainantPhone: z.string().optional(),
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  autoRoute: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body;
    const slaRules = await prisma.supportSlaRule.findMany({ where: { isActive: true } });

    let categoryId = body.categoryId;
    let priority = body.priority || 'MEDIUM';
    let department: string | undefined;

    if (body.autoRoute !== false) {
      const suggestion = suggestRouting(body.subject, body.description);
      if (!categoryId) {
        const cat = await prisma.supportCategory.findFirst({ where: { slug: suggestion.categorySlug } });
        if (cat) categoryId = cat.id;
      }
      if (!body.priority) priority = suggestion.priority;
      department = suggestion.department;
    }

    if (categoryId && !body.priority) {
      const cat = await prisma.supportCategory.findUnique({ where: { id: categoryId } });
      if (cat) {
        priority = cat.defaultPriority;
        department = cat.department || department;
      }
    }

    const sla = computeSlaDue(priority, slaRules);
    const ticketId = generateTicketId();

    const ticket = await prisma.complaint.create({
      data: {
        ticketId,
        subject: body.subject,
        description: body.description,
        kind: body.kind || 'SUPPORT_REQUEST',
        categoryId,
        priority,
        department,
        complainantType: body.complainantType || 'GUEST',
        complainantName: body.complainantName,
        complainantEmail: body.complainantEmail,
        complainantPhone: body.complainantPhone,
        organizationId: body.organizationId,
        userId: body.userId,
        status: 'NEW',
        ...sla,
      },
      include: ticketInclude,
    });

    await logTicketHistory(ticket.id, 'CREATED', { toValue: 'NEW', performedByEmail: req.user?.email });
    if (department) {
      const rule = await prisma.supportAssignmentRule.findFirst({
        where: { department, isActive: true },
      });
      if (rule) await logTicketHistory(ticket.id, 'AUTO_ROUTED', { toValue: department, details: { rule: rule.name } });
    }

    sendSuccess(res, ticket, 'Ticket created', 201);
  } catch (err) { next(err); }
});

router.patch('/tickets/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new AppError('Ticket not found', 404);

    const data: Prisma.ComplaintUpdateInput = {};
    const allowed = ['subject', 'description', 'priority', 'status', 'categoryId', 'department', 'resolution', 'kind'] as const;
    for (const f of allowed) {
      if (req.body[f] !== undefined) (data as Record<string, unknown>)[f] = req.body[f];
    }

    if (req.body.priority && req.body.priority !== existing.priority) {
      await logTicketHistory(id, 'PRIORITY_CHANGED', {
        fromValue: existing.priority,
        toValue: req.body.priority,
        performedByEmail: req.user?.email,
      });
    }
    if (req.body.status && req.body.status !== existing.status) {
      await logTicketHistory(id, 'STATUS_CHANGED', {
        fromValue: existing.status,
        toValue: req.body.status,
        performedByEmail: req.user?.email,
      });
      if (req.body.status === 'RESOLVED') data.resolvedAt = new Date();
      if (req.body.status === 'CLOSED') data.closedAt = new Date();
    }

    const ticket = await prisma.complaint.update({ where: { id }, data, include: ticketInclude });
    await logAudit(req, 'UPDATE', 'Complaint', id, req.body);
    sendSuccess(res, ticket);
  } catch (err) { next(err); }
});

router.post('/tickets/:id/assign', validateBody(z.object({
  assignedToId: z.string(),
  department: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const staff = await prisma.user.findUnique({ where: { id: req.body.assignedToId } });
    if (!staff) throw new AppError('Staff not found', 404);

    const ticket = await prisma.complaint.update({
      where: { id },
      data: {
        assignedToId: req.body.assignedToId,
        department: req.body.department,
        status: 'ASSIGNED',
      },
      include: ticketInclude,
    });

    await logTicketHistory(id, 'ASSIGNED', {
      toValue: staff.email,
      performedByEmail: req.user?.email,
      details: { department: req.body.department },
    });
    sendSuccess(res, ticket, 'Ticket assigned');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/transfer', validateBody(z.object({
  toStaffId: z.string().optional(),
  toDepartment: z.string().optional(),
  reason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new AppError('Ticket not found', 404);

    await prisma.supportTicketTransfer.create({
      data: {
        complaintId: id,
        fromStaffId: existing.assignedToId,
        toStaffId: req.body.toStaffId,
        toDepartment: req.body.toDepartment,
        reason: req.body.reason,
        transferredByEmail: req.user?.email,
      },
    });

    const ticket = await prisma.complaint.update({
      where: { id },
      data: {
        assignedToId: req.body.toStaffId || existing.assignedToId,
        department: req.body.toDepartment || existing.department,
      },
      include: ticketInclude,
    });

    await logTicketHistory(id, 'TRANSFERRED', {
      fromValue: existing.assignedToId || undefined,
      toValue: req.body.toStaffId || req.body.toDepartment,
      performedByEmail: req.user?.email,
      details: { reason: req.body.reason },
    });
    sendSuccess(res, ticket, 'Ticket transferred');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/escalate', validateBody(z.object({
  escalatedTo: z.string().optional(),
  reason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.update({
      where: { id },
      data: { status: 'ESCALATED', escalatedAt: new Date(), escalatedTo: req.body.escalatedTo },
      include: ticketInclude,
    });
    await logTicketHistory(id, 'ESCALATED', { toValue: req.body.escalatedTo, performedByEmail: req.user?.email, details: { reason: req.body.reason } });
    sendSuccess(res, ticket, 'Ticket escalated');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/reply', validateBody(z.object({
  body: z.string().min(1),
  attachments: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.findUnique({ where: { id } });
    if (!ticket) throw new AppError('Ticket not found', 404);

    const msg = await prisma.supportTicketMessage.create({
      data: {
        complaintId: id,
        senderId: req.user?.userId,
        senderName: req.user?.email,
        senderType: 'staff',
        body: req.body.body,
        isInternal: false,
        attachments: req.body.attachments as Prisma.InputJsonValue,
      },
    });

    const updates: Prisma.ComplaintUpdateInput = { status: 'IN_PROGRESS' };
    if (!ticket.firstResponseAt) updates.firstResponseAt = new Date();

    await prisma.complaint.update({ where: { id }, data: updates });
    await logTicketHistory(id, 'STAFF_REPLIED', { performedByEmail: req.user?.email });
    sendSuccess(res, msg, 'Reply sent', 201);
  } catch (err) { next(err); }
});

router.post('/tickets/:id/internal-note', validateBody(z.object({
  body: z.string().min(1),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const msg = await prisma.supportTicketMessage.create({
      data: {
        complaintId: id,
        senderId: req.user?.userId,
        senderName: req.user?.email,
        senderType: 'staff',
        body: req.body.body,
        isInternal: true,
      },
    });
    await logTicketHistory(id, 'INTERNAL_NOTE', { performedByEmail: req.user?.email });
    sendSuccess(res, msg, 'Internal note added', 201);
  } catch (err) { next(err); }
});

router.post('/tickets/:id/resolve', validateBody(z.object({
  resolution: z.string().min(1),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.update({
      where: { id },
      data: { status: 'RESOLVED', resolution: req.body.resolution, resolvedAt: new Date() },
      include: ticketInclude,
    });
    await logTicketHistory(id, 'RESOLVED', { performedByEmail: req.user?.email });
    sendSuccess(res, ticket, 'Ticket resolved');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/close', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: ticketInclude,
    });
    await logTicketHistory(id, 'CLOSED', { performedByEmail: req.user?.email });
    sendSuccess(res, ticket, 'Ticket closed');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/reopen', validateBody(z.object({
  reason: z.string().min(3),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.update({
      where: { id },
      data: { status: 'REOPENED', reopenReason: req.body.reason, resolvedAt: null, closedAt: null },
      include: ticketInclude,
    });
    await logTicketHistory(id, 'REOPENED', { performedByEmail: req.user?.email, details: { reason: req.body.reason } });
    sendSuccess(res, ticket, 'Ticket reopened');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/archive', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.update({ where: { id }, data: { isArchived: true } });
    await logTicketHistory(id, 'ARCHIVED', { performedByEmail: req.user?.email });
    sendSuccess(res, ticket, 'Ticket archived');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/csat', validateBody(z.object({
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
})), async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ticket = await prisma.complaint.update({
      where: { id },
      data: { csatRating: req.body.rating, csatFeedback: req.body.feedback },
    });
    sendSuccess(res, ticket, 'Feedback submitted');
  } catch (err) { next(err); }
});

// ─── Categories ────────────────────────────────────────────────────────────────

router.get('/categories', async (_req, res, next) => {
  try {
    const cats = await prisma.supportCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { complaints: true } } } });
    sendSuccess(res, cats);
  } catch (err) { next(err); }
});

router.post('/categories', validateBody(z.object({
  name: z.string(), slug: z.string(), description: z.string().optional(),
  userTypes: z.array(z.string()).optional(), defaultPriority: z.string().optional(), department: z.string().optional(),
})), async (req, res, next) => {
  try {
    const cat = await prisma.supportCategory.create({ data: req.body });
    sendSuccess(res, cat, 'Category created', 201);
  } catch (err) { next(err); }
});

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const cat = await prisma.supportCategory.update({ where: { id: paramId(req.params.id) }, data: req.body });
    sendSuccess(res, cat);
  } catch (err) { next(err); }
});

// ─── SLA ─────────────────────────────────────────────────────────────────────

router.get('/sla', async (_req, res, next) => {
  try {
    const rules = await prisma.supportSlaRule.findMany({ orderBy: { responseMinutes: 'asc' } });
    sendSuccess(res, rules);
  } catch (err) { next(err); }
});

router.patch('/sla/:id', async (req, res, next) => {
  try {
    const rule = await prisma.supportSlaRule.update({ where: { id: paramId(req.params.id) }, data: req.body });
    sendSuccess(res, rule);
  } catch (err) { next(err); }
});

// ─── Assignment Rules ────────────────────────────────────────────────────────

router.get('/assignment-rules', async (_req, res, next) => {
  try {
    const rules = await prisma.supportAssignmentRule.findMany({ orderBy: { name: 'asc' } });
    sendSuccess(res, rules);
  } catch (err) { next(err); }
});

router.post('/assignment-rules', validateBody(z.object({
  name: z.string(), categorySlug: z.string().optional(), keywordPattern: z.string().optional(),
  department: z.string(), teamName: z.string().optional(), defaultPriority: z.string().optional(),
})), async (req, res, next) => {
  try {
    const rule = await prisma.supportAssignmentRule.create({ data: req.body });
    sendSuccess(res, rule, 'Rule created', 201);
  } catch (err) { next(err); }
});

// ─── Canned Responses ────────────────────────────────────────────────────────

router.get('/canned-responses', async (_req, res, next) => {
  try {
    const items = await prisma.supportCannedResponse.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/canned-responses', validateBody(z.object({
  title: z.string(), body: z.string(), category: z.string().optional(),
})), async (req, res, next) => {
  try {
    const item = await prisma.supportCannedResponse.create({ data: req.body });
    sendSuccess(res, item, 'Canned response created', 201);
  } catch (err) { next(err); }
});

// ─── Knowledge Base ──────────────────────────────────────────────────────────

router.get('/knowledge-base', async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const articles = await prisma.supportKnowledgeArticle.findMany({
      where: search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { content: { contains: search, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, articles);
  } catch (err) { next(err); }
});

router.post('/knowledge-base', validateBody(z.object({
  title: z.string(), slug: z.string(), content: z.string(), category: z.string().optional(), tags: z.array(z.string()).optional(), isPublished: z.boolean().optional(),
})), async (req, res, next) => {
  try {
    const article = await prisma.supportKnowledgeArticle.create({ data: req.body });
    sendSuccess(res, article, 'Article created', 201);
  } catch (err) { next(err); }
});

// ─── Analytics & Performance ─────────────────────────────────────────────────

router.get('/analytics', async (_req, res, next) => {
  try {
    const [byCategory, byStatus, byPriority] = await Promise.all([
      prisma.complaint.groupBy({ by: ['categoryId'], _count: true, where: { isArchived: false } }),
      prisma.complaint.groupBy({ by: ['status'], _count: true, where: { isArchived: false } }),
      prisma.complaint.groupBy({ by: ['priority'], _count: true, where: { isArchived: false } }),
    ]);

    const categories = await prisma.supportCategory.findMany();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await prisma.complaint.count({ where: { createdAt: { gte: start, lt: end } } });
      last7Days.push({ date: start.toLocaleDateString('en', { weekday: 'short' }), count });
    }

    sendSuccess(res, {
      ticketsPerDay: last7Days,
      byCategory: byCategory.map((b) => ({ category: b.categoryId ? catMap[b.categoryId] || 'Unknown' : 'Uncategorized', count: b._count })),
      byStatus: byStatus.map((b) => ({ status: b.status, count: b._count })),
      byPriority: byPriority.map((b) => ({ priority: b.priority, count: b._count })),
      resolutionRate: await prisma.complaint.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
      totalTickets: await prisma.complaint.count(),
    });
  } catch (err) { next(err); }
});

router.get('/staff-performance', async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['PLATFORM_STAFF', 'SUPER_ADMIN'] } },
      select: { id: true, email: true },
    });

    const performance = await Promise.all(staff.map(async (s) => {
      const [assigned, resolved, pending, csat] = await Promise.all([
        prisma.complaint.count({ where: { assignedToId: s.id } }),
        prisma.complaint.count({ where: { assignedToId: s.id, status: { in: ['RESOLVED', 'CLOSED'] } } }),
        prisma.complaint.count({ where: { assignedToId: s.id, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
        prisma.complaint.aggregate({ where: { assignedToId: s.id, csatRating: { not: null } }, _avg: { csatRating: true } }),
      ]);
      return {
        email: s.email,
        assigned,
        resolved,
        pending,
        csat: csat._avg.csatRating ? Math.round(csat._avg.csatRating * 10) / 10 : null,
      };
    }));

    sendSuccess(res, performance.filter((p) => p.assigned > 0));
  } catch (err) { next(err); }
});

router.get('/csat', async (_req, res, next) => {
  try {
    const agg = await prisma.complaint.aggregate({
      where: { csatRating: { not: null } },
      _avg: { csatRating: true },
      _count: { csatRating: true },
    });
    const distribution = await prisma.complaint.groupBy({
      by: ['csatRating'],
      _count: true,
      where: { csatRating: { not: null } },
    });
    sendSuccess(res, { average: agg._avg.csatRating, count: agg._count.csatRating, distribution });
  } catch (err) { next(err); }
});

// ─── Teams ───────────────────────────────────────────────────────────────────

router.get('/teams', async (_req, res, next) => {
  try {
    const teams = await prisma.supportTeam.findMany({ orderBy: { name: 'asc' } });
    sendSuccess(res, teams);
  } catch (err) { next(err); }
});

router.post('/teams', validateBody(z.object({
  name: z.string(), department: z.string().optional(), description: z.string().optional(),
})), async (req, res, next) => {
  try {
    const team = await prisma.supportTeam.create({ data: req.body });
    sendSuccess(res, team, 'Team created', 201);
  } catch (err) { next(err); }
});

// Suggest articles before ticket creation
router.get('/suggest-articles', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q) return sendSuccess(res, []);
    const articles = await prisma.supportKnowledgeArticle.findMany({
      where: { isPublished: true, OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }] },
      take: 5,
      select: { id: true, title: true, slug: true, category: true },
    });
    sendSuccess(res, articles);
  } catch (err) { next(err); }
});

export default router;
