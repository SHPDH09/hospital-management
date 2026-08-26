import { Router } from 'express';
import { z } from 'zod';
import { Prisma, CommunicationChannel, CommunicationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();

const VARIABLES = [
  'patient_name', 'doctor_name', 'hospital_name', 'clinic_name',
  'appointment_date', 'appointment_time', 'appointment_id',
  'invoice_number', 'amount',
];

function substituteVars(text: string, vars: Record<string, string>) {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return out;
}

async function simulateSend(channel: CommunicationChannel, body: string, recipient: { email?: string; phone?: string }) {
  if (channel === 'EMAIL' && !recipient.email) throw new Error('Email required');
  if ((channel === 'SMS' || channel === 'WHATSAPP') && !recipient.phone) throw new Error('Phone required');
  // Simulated delivery — integrate real providers via Provider Settings
  return { delivered: true, cost: channel === 'EMAIL' ? 0.01 : channel === 'SMS' ? 0.15 : channel === 'WHATSAPP' ? 0.25 : 0 };
}

type Recipient = { id: string; name: string; email?: string; phone?: string; type: string };

async function resolveAudience(audience: {
  userType?: string;
  organizationId?: string;
  userId?: string;
  city?: string;
  state?: string;
  subscriptionPlan?: string;
  status?: string;
}): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  if (audience.userId) {
    const u = await prisma.user.findUnique({ where: { id: audience.userId }, include: { patient: true, doctor: true, staff: true } });
    if (u) recipients.push({ id: u.id, name: u.patient?.fullName || u.doctor?.fullName || u.staff?.fullName || u.email, email: u.email, phone: u.phone || undefined, type: u.role });
    return recipients;
  }

  if (audience.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: audience.organizationId } });
    const staff = await prisma.staff.findMany({ where: { organizationId: audience.organizationId }, include: { user: true } });
    if (org) recipients.push({ id: org.id, name: org.name, email: org.email || undefined, phone: org.phone || undefined, type: org.type });
    staff.forEach((s) => recipients.push({ id: s.userId, name: s.fullName, email: s.user.email, phone: s.user.phone || undefined, type: s.role }));
    return recipients;
  }

  const userType = audience.userType?.toUpperCase();

  if (!userType || userType === 'PATIENT') {
    const patients = await prisma.user.findMany({
      where: {
        role: 'PATIENT',
        isActive: audience.status !== 'INACTIVE',
        ...(audience.city && { patient: { city: { contains: audience.city, mode: 'insensitive' } } }),
        ...(audience.state && { patient: { state: { contains: audience.state, mode: 'insensitive' } } }),
      },
      include: { patient: true },
      take: 500,
    });
    patients.forEach((u) => recipients.push({ id: u.id, name: u.patient?.fullName || u.email, email: u.email, phone: u.phone || undefined, type: 'PATIENT' }));
  }

  if (!userType || userType === 'DOCTOR') {
    const doctors = await prisma.doctor.findMany({ where: { isActive: true }, include: { user: true, organization: true }, take: 200 });
    doctors.forEach((d) => recipients.push({ id: d.userId, name: d.fullName, email: d.user.email, phone: d.user.phone || undefined, type: 'DOCTOR' }));
  }

  if (!userType || userType === 'HOSPITAL' || userType === 'CLINIC') {
    const orgs = await prisma.organization.findMany({
      where: {
        isActive: true,
        ...(userType === 'HOSPITAL' && { type: 'HOSPITAL' }),
        ...(userType === 'CLINIC' && { type: 'CLINIC' }),
        ...(audience.city && { city: { contains: audience.city, mode: 'insensitive' } }),
        ...(audience.state && { state: { contains: audience.state, mode: 'insensitive' } }),
      },
      take: 200,
    });
    orgs.forEach((o) => recipients.push({ id: o.id, name: o.name, email: o.email || undefined, phone: o.phone || undefined, type: o.type }));
  }

  if (!userType || userType === 'STAFF') {
    const staff = await prisma.staff.findMany({ include: { user: true }, take: 200 });
    staff.forEach((s) => recipients.push({ id: s.userId, name: s.fullName, email: s.user.email, phone: s.user.phone || undefined, type: s.role }));
  }

  return recipients;
}

async function dispatchMessages(
  req: AuthRequest,
  opts: {
    channel: CommunicationChannel;
    subject?: string;
    body: string;
    templateId?: string;
    campaignId?: string;
    scheduledAt?: Date;
    audience: Record<string, unknown>;
    variables?: Record<string, string>;
  }
) {
  const recipients = await resolveAudience(opts.audience as never);
  if (recipients.length === 0) throw new AppError('No recipients matched audience filters', 400);

  const isScheduled = opts.scheduledAt && opts.scheduledAt > new Date();
  const results = [];

  for (const r of recipients) {
    const vars = {
      patient_name: r.name,
      doctor_name: r.name,
      hospital_name: r.name,
      clinic_name: r.name,
      appointment_date: '',
      appointment_time: '',
      appointment_id: '',
      invoice_number: '',
      amount: '',
      ...opts.variables,
    };
    const body = substituteVars(opts.body, vars);
    const subject = opts.subject ? substituteVars(opts.subject, vars) : undefined;

    let status: CommunicationStatus = isScheduled ? 'SCHEDULED' : 'PENDING';
    let sentAt: Date | undefined;
    let deliveredAt: Date | undefined;
    let cost: number | undefined;
    let failureReason: string | undefined;

    if (!isScheduled) {
      try {
        const result = await simulateSend(opts.channel, body, { email: r.email, phone: r.phone });
        status = result.delivered ? 'DELIVERED' : 'SENT';
        sentAt = new Date();
        deliveredAt = result.delivered ? new Date() : undefined;
        cost = result.cost;
      } catch (e) {
        status = 'FAILED';
        failureReason = e instanceof Error ? e.message : 'Send failed';
      }
    }

    const msg = await prisma.communicationMessage.create({
      data: {
        channel: opts.channel,
        status,
        recipientType: r.type,
        recipientId: r.id,
        recipientEmail: r.email,
        recipientPhone: r.phone,
        recipientName: r.name,
        subject,
        body,
        templateId: opts.templateId,
        campaignId: opts.campaignId,
        scheduledAt: opts.scheduledAt,
        sentAt,
        deliveredAt,
        failureReason,
        cost,
        createdById: req.user?.userId,
        createdByEmail: req.user?.email,
      },
    });
    results.push(msg);
  }

  return { count: results.length, messages: results };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const channelCount = async (ch: CommunicationChannel, extra?: Prisma.CommunicationMessageWhereInput) =>
      prisma.communicationMessage.count({ where: { channel: ch, ...extra } });

    const [email, sms, whatsapp, push, failed, pending, scheduled, todayTotal, monthMsgs] = await Promise.all([
      channelCount('EMAIL', { status: { in: ['SENT', 'DELIVERED'] } }),
      channelCount('SMS', { status: { in: ['SENT', 'DELIVERED'] } }),
      channelCount('WHATSAPP', { status: { in: ['SENT', 'DELIVERED'] } }),
      channelCount('PUSH', { status: { in: ['SENT', 'DELIVERED'] } }),
      prisma.communicationMessage.count({ where: { status: 'FAILED' } }),
      prisma.communicationMessage.count({ where: { status: 'PENDING' } }),
      prisma.communicationMessage.count({ where: { status: 'SCHEDULED' } }),
      prisma.communicationMessage.count({ where: { createdAt: { gte: today } } }),
      prisma.communicationMessage.findMany({ where: { createdAt: { gte: monthStart } }, select: { channel: true, status: true, cost: true, createdAt: true } }),
    ]);

    const monthlyCost = monthMsgs.reduce((s, m) => s + (m.cost || 0), 0);
    const delivered = monthMsgs.filter((m) => m.status === 'DELIVERED' || m.status === 'SENT').length;
    const deliveryRate = monthMsgs.length ? Math.round((delivered / monthMsgs.length) * 100) : 0;

    const usageByChannel = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].map((ch) => ({
      channel: ch,
      count: monthMsgs.filter((m) => m.channel === ch).length,
    }));

    sendSuccess(res, {
      email, sms, whatsapp, push, failed, pending, scheduled,
      todayTotal, monthlyCost, deliveryRate,
      failureRate: 100 - deliveryRate,
      usageByChannel,
    });
  } catch (err) { next(err); }
});

// ─── Templates ───────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(2),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
  category: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

router.get('/templates', async (req, res, next) => {
  try {
    const channel = req.query.channel as string | undefined;
    const category = req.query.category as string | undefined;
    const templates = await prisma.communicationTemplate.findMany({
      where: { ...(channel && { channel: channel as CommunicationChannel }), ...(category && { category }) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    sendSuccess(res, templates);
  } catch (err) { next(err); }
});

router.post('/templates', validateBody(templateSchema), async (req: AuthRequest, res, next) => {
  try {
    const tpl = await prisma.communicationTemplate.create({
      data: { ...req.body, variables: req.body.variables || VARIABLES },
    });
    await logAudit(req, 'CREATE', 'CommunicationTemplate', tpl.id);
    sendSuccess(res, tpl, 'Template created', 201);
  } catch (err) { next(err); }
});

router.patch('/templates/:id', validateBody(templateSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const tpl = await prisma.communicationTemplate.update({ where: { id }, data: req.body });
    sendSuccess(res, tpl);
  } catch (err) { next(err); }
});

router.delete('/templates/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.communicationTemplate.delete({ where: { id } });
    sendSuccess(res, null, 'Deleted');
  } catch (err) { next(err); }
});

router.get('/variables', (_req, res) => {
  sendSuccess(res, VARIABLES.map((v) => `{{${v}}}`));
});

// ─── Send messages ───────────────────────────────────────────────────────────

const sendSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
  subject: z.string().optional(),
  body: z.string().min(1),
  templateId: z.string().optional(),
  scheduledAt: z.string().optional(),
  audience: z.object({
    userType: z.string().optional(),
    organizationId: z.string().optional(),
    userId: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    subscriptionPlan: z.string().optional(),
    status: z.string().optional(),
  }),
  variables: z.record(z.string()).optional(),
});

router.post('/send', validateBody(sendSchema), async (req: AuthRequest, res, next) => {
  try {
    const { channel, subject, body, templateId, scheduledAt, audience, variables } = req.body;
    let finalBody = body;
    let finalSubject = subject;
    if (templateId) {
      const tpl = await prisma.communicationTemplate.findUnique({ where: { id: templateId } });
      if (!tpl) throw new AppError('Template not found', 404);
      finalBody = tpl.body;
      finalSubject = tpl.subject || subject;
    }
    const result = await dispatchMessages(req, {
      channel, subject: finalSubject, body: finalBody, templateId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      audience, variables,
    });
    sendSuccess(res, result, `Message queued for ${result.count} recipients`, 201);
  } catch (err) { next(err); }
});

// ─── History & Failed ────────────────────────────────────────────────────────

router.get('/history', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const channel = req.query.channel as string | undefined;
    const status = req.query.status as string | undefined;

    const where = {
      ...(channel && { channel: channel as CommunicationChannel }),
      ...(status && { status: status as CommunicationStatus }),
    };

    const [messages, total] = await Promise.all([
      prisma.communicationMessage.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.communicationMessage.count({ where }),
    ]);
    sendPaginated(res, messages, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/failed', async (req, res, next) => {
  try {
    const messages = await prisma.communicationMessage.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    sendSuccess(res, messages);
  } catch (err) { next(err); }
});

router.post('/retry/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const msg = await prisma.communicationMessage.findUnique({ where: { id } });
    if (!msg || msg.status !== 'FAILED') throw new AppError('Message not found or not failed', 400);

    try {
      await simulateSend(msg.channel, msg.body, { email: msg.recipientEmail || undefined, phone: msg.recipientPhone || undefined });
      const updated = await prisma.communicationMessage.update({
        where: { id },
        data: { status: 'DELIVERED', sentAt: new Date(), deliveredAt: new Date(), failureReason: null, failedAt: null },
      });
      sendSuccess(res, updated, 'Retry successful');
    } catch (e) {
      await prisma.communicationMessage.update({
        where: { id },
        data: { failureReason: e instanceof Error ? e.message : 'Retry failed', failedAt: new Date() },
      });
      throw new AppError('Retry failed', 500);
    }
  } catch (err) { next(err); }
});

router.post('/retry-all', async (req: AuthRequest, res, next) => {
  try {
    const failed = await prisma.communicationMessage.findMany({ where: { status: 'FAILED' }, take: 100 });
    let success = 0;
    for (const msg of failed) {
      try {
        await simulateSend(msg.channel, msg.body, { email: msg.recipientEmail || undefined, phone: msg.recipientPhone || undefined });
        await prisma.communicationMessage.update({
          where: { id: msg.id },
          data: { status: 'DELIVERED', sentAt: new Date(), deliveredAt: new Date(), failureReason: null },
        });
        success++;
      } catch { /* keep failed */ }
    }
    sendSuccess(res, { retried: failed.length, success });
  } catch (err) { next(err); }
});

// ─── Campaigns ───────────────────────────────────────────────────────────────

router.get('/campaigns', async (_req, res, next) => {
  try {
    const campaigns = await prisma.communicationCampaign.findMany({ orderBy: { createdAt: 'desc' } });
    sendSuccess(res, campaigns);
  } catch (err) { next(err); }
});

router.post('/campaigns', validateBody(z.object({
  name: z.string(), description: z.string().optional(),
  channels: z.array(z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'])),
  audience: z.record(z.unknown()), subject: z.string().optional(), body: z.string(),
  scheduledAt: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.communicationCampaign.create({
      data: {
        ...req.body,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
        status: req.body.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        createdById: req.user?.userId,
        createdByEmail: req.user?.email,
      },
    });
    sendSuccess(res, campaign, 'Campaign created', 201);
  } catch (err) { next(err); }
});

router.post('/campaigns/:id/send', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const campaign = await prisma.communicationCampaign.findUnique({ where: { id } });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const results = [];
    for (const channel of campaign.channels) {
      const r = await dispatchMessages(req, {
        channel, subject: campaign.subject || undefined, body: campaign.body,
        campaignId: id, audience: campaign.audience as Record<string, unknown>,
      });
      results.push(r);
    }

    await prisma.communicationCampaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), stats: { results } as Prisma.InputJsonValue },
    });
    sendSuccess(res, { results }, 'Campaign sent');
  } catch (err) { next(err); }
});

// ─── Scheduled ───────────────────────────────────────────────────────────────

router.get('/scheduled', async (_req, res, next) => {
  try {
    const items = await prisma.scheduledCommunication.findMany({ orderBy: { createdAt: 'desc' } });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/scheduled', validateBody(z.object({
  name: z.string(), channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
  cronExpr: z.string().optional(), runAt: z.string().optional(),
  templateId: z.string().optional(), audience: z.record(z.unknown()),
})), async (req: AuthRequest, res, next) => {
  try {
    const item = await prisma.scheduledCommunication.create({
      data: {
        ...req.body,
        runAt: req.body.runAt ? new Date(req.body.runAt) : undefined,
        nextRunAt: req.body.runAt ? new Date(req.body.runAt) : undefined,
      },
    });
    sendSuccess(res, item, 'Scheduled', 201);
  } catch (err) { next(err); }
});

// ─── Announcements ───────────────────────────────────────────────────────────

router.get('/announcements', async (_req, res, next) => {
  try {
    const items = await prisma.systemAnnouncement.findMany({ orderBy: { createdAt: 'desc' } });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/announcements', validateBody(z.object({
  title: z.string(), message: z.string(),
  type: z.enum(['INFORMATION', 'WARNING', 'MAINTENANCE', 'EMERGENCY']),
  audience: z.array(z.string()), endsAt: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const item = await prisma.systemAnnouncement.create({
      data: { ...req.body, endsAt: req.body.endsAt ? new Date(req.body.endsAt) : undefined },
    });
    sendSuccess(res, item, 'Announcement created', 201);
  } catch (err) { next(err); }
});

router.patch('/announcements/:id/deactivate', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const item = await prisma.systemAnnouncement.update({ where: { id }, data: { isActive: false } });
    sendSuccess(res, item);
  } catch (err) { next(err); }
});

// ─── Usage & Provider Settings ───────────────────────────────────────────────

router.get('/usage', async (_req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const msgs = await prisma.communicationMessage.findMany({
      where: { createdAt: { gte: monthStart }, status: { in: ['SENT', 'DELIVERED'] } },
      select: { channel: true, cost: true },
    });
    const byChannel = { EMAIL: 0, SMS: 0, WHATSAPP: 0, PUSH: 0 };
    let totalCost = 0;
    for (const m of msgs) {
      byChannel[m.channel]++;
      totalCost += m.cost || 0;
    }
    sendSuccess(res, {
      month: monthStart.toLocaleString('en', { month: 'long', year: 'numeric' }),
      email: byChannel.EMAIL, sms: byChannel.SMS, whatsapp: byChannel.WHATSAPP, push: byChannel.PUSH,
      estimatedCost: Math.round(totalCost * 100) / 100,
    });
  } catch (err) { next(err); }
});

const PROVIDER_KEYS = ['comm.email', 'comm.sms', 'comm.whatsapp', 'comm.push', 'comm.permissions'];

router.get('/providers', async (_req, res, next) => {
  try {
    const settings = await prisma.platformSetting.findMany({ where: { category: 'communication' } });
    const masked = settings.map((s) => {
      const val = s.value as Record<string, unknown>;
      const safe = { ...val };
      if (safe.apiKey) safe.apiKey = '••••••••';
      if (safe.password) safe.password = '••••••••';
      return { key: s.key, value: safe };
    });
    sendSuccess(res, masked);
  } catch (err) { next(err); }
});

router.put('/providers/:key', validateBody(z.record(z.unknown())), async (req: AuthRequest, res, next) => {
  try {
    const key = `comm.${req.params.key}`;
    const existing = await prisma.platformSetting.findUnique({ where: { key } });
    const merged = existing
      ? { ...(existing.value as object), ...req.body, ...(req.body.apiKey === '••••••••' && { apiKey: (existing.value as { apiKey?: string }).apiKey }) }
      : req.body;
    const setting = await prisma.platformSetting.upsert({
      where: { key },
      update: { value: merged as Prisma.InputJsonValue },
      create: { key, value: merged as Prisma.InputJsonValue, category: 'communication' },
    });
    await logAudit(req, 'UPDATE', 'CommunicationProvider', key);
    sendSuccess(res, setting, 'Provider settings saved');
  } catch (err) { next(err); }
});

router.get('/permissions', async (_req, res, next) => {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'comm.permissions' } });
    sendSuccess(res, setting?.value || {
      HOSPITAL_ADMIN: { appointmentNotify: true, marketing: false, platformAnnounce: false },
      PLATFORM_STAFF: { appointmentNotify: true, marketing: true, platformAnnounce: false },
      SUPPORT_STAFF: { individual: true, bulkMarketing: false },
    });
  } catch (err) { next(err); }
});

router.put('/permissions', validateBody(z.record(z.unknown())), async (req: AuthRequest, res, next) => {
  try {
    await prisma.platformSetting.upsert({
      where: { key: 'comm.permissions' },
      update: { value: req.body as Prisma.InputJsonValue },
      create: { key: 'comm.permissions', value: req.body as Prisma.InputJsonValue, category: 'communication' },
    });
    sendSuccess(res, req.body, 'Permissions updated');
  } catch (err) { next(err); }
});

// ─── Audience preview ────────────────────────────────────────────────────────

router.post('/audience/preview', validateBody(z.object({ audience: z.record(z.unknown()) })), async (req, res, next) => {
  try {
    const recipients = await resolveAudience(req.body.audience as never);
    sendSuccess(res, { count: recipients.length, sample: recipients.slice(0, 10) });
  } catch (err) { next(err); }
});

export default router;
