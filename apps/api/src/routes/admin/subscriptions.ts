import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();

const planSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  tier: z.enum(['FREE', 'BASIC', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice: z.number().min(0).optional(),
  trialDays: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  userLimit: z.number().int().optional(),
  doctorLimit: z.number().int().optional(),
  patientLimit: z.number().int().optional(),
  storageLimitMb: z.number().int().optional(),
  branchLimit: z.number().int().optional(),
  appointmentLimit: z.number().int().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function recordHistory(
  subscriptionId: string,
  organizationId: string,
  data: {
    previousPlanId?: string | null;
    newPlanId?: string | null;
    previousPrice?: number | null;
    newPrice?: number | null;
    previousStatus?: string | null;
    newStatus?: string | null;
    reason?: string;
    changeSource?: 'MANUAL' | 'PAYMENT' | 'SYSTEM';
    changedById?: string;
    changedByEmail?: string;
  }
) {
  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId,
      organizationId,
      previousPlanId: data.previousPlanId || undefined,
      newPlanId: data.newPlanId || undefined,
      previousPrice: data.previousPrice ?? undefined,
      newPrice: data.newPrice ?? undefined,
      previousStatus: data.previousStatus || undefined,
      newStatus: data.newStatus || undefined,
      reason: data.reason,
      changeSource: data.changeSource || 'MANUAL',
      changedById: data.changedById,
      changedByEmail: data.changedByEmail,
    },
  });
}

// ─── Overview ────────────────────────────────────────────────────────────────

router.get('/overview', async (_req, res, next) => {
  try {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const [active, trial, suspended, expired, expiringSoon, totalPlans, defaultPlan] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIAL' } }),
      prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIAL'] }, endDate: { lte: in30Days, gte: now } } }),
      prisma.subscriptionPlan.count({ where: { isActive: true } }),
      prisma.subscriptionPlan.findFirst({ where: { isDefault: true } }),
    ]);

    sendSuccess(res, { active, trial, suspended, expired, expiringSoon, totalPlans, defaultPlan });
  } catch (err) { next(err); }
});

// ─── Plans CRUD ──────────────────────────────────────────────────────────────

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }] });
    sendSuccess(res, plans);
  } catch (err) { next(err); }
});

router.post('/plans', validateBody(planSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = req.body;
    const plan = await prisma.subscriptionPlan.create({
      data: {
        ...data,
        price: data.monthlyPrice ?? data.price ?? 0,
        features: data.features || [],
      },
    });
    await logAudit(req, 'CREATE', 'SubscriptionPlan', plan.id);
    sendSuccess(res, plan, 'Plan created', 201);
  } catch (err) { next(err); }
});

router.patch('/plans/:id', validateBody(planSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const data = { ...req.body };
    if (data.monthlyPrice !== undefined) data.price = data.monthlyPrice;
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data });
    await logAudit(req, 'UPDATE', 'SubscriptionPlan', id, data);
    sendSuccess(res, plan);
  } catch (err) { next(err); }
});

router.patch('/plans/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: true } });
    await logAudit(req, 'ACTIVATE', 'SubscriptionPlan', id);
    sendSuccess(res, plan);
  } catch (err) { next(err); }
});

router.patch('/plans/:id/deactivate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false, isDefault: false } });
    await logAudit(req, 'DEACTIVATE', 'SubscriptionPlan', id);
    sendSuccess(res, plan);
  } catch (err) { next(err); }
});

router.delete('/plans/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const inUse = await prisma.subscription.count({ where: { planId: id } });
    if (inUse > 0) throw new AppError('Cannot delete plan with active subscriptions', 400);
    await prisma.subscriptionPlan.delete({ where: { id } });
    await logAudit(req, 'DELETE', 'SubscriptionPlan', id);
    sendSuccess(res, null, 'Plan deleted');
  } catch (err) { next(err); }
});

router.put('/plans/:id/set-default', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.subscriptionPlan.updateMany({ data: { isDefault: false } });
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: { isDefault: true, isActive: true } });
    await prisma.platformSetting.upsert({
      where: { key: 'defaultSubscriptionPlanId' },
      update: { value: id as unknown as Prisma.InputJsonValue },
      create: { key: 'defaultSubscriptionPlanId', value: id, category: 'subscription' },
    });
    await logAudit(req, 'SET_DEFAULT', 'SubscriptionPlan', id);
    sendSuccess(res, plan, 'Default plan updated');
  } catch (err) { next(err); }
});

// ─── Default plan settings ───────────────────────────────────────────────────

router.get('/settings/default-plan', async (_req, res, next) => {
  try {
    const plan = await prisma.subscriptionPlan.findFirst({ where: { isDefault: true } });
    sendSuccess(res, plan);
  } catch (err) { next(err); }
});

// ─── Payment history (platform-wide) ─────────────────────────────────────────

router.get('/payments/all', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bill: {
            select: {
              billNumber: true,
              organization: { select: { id: true, name: true, type: true } },
              patient: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.payment.count(),
    ]);
    sendPaginated(res, payments, { page, limit, total });
  } catch (err) { next(err); }
});

// ─── All subscriptions ───────────────────────────────────────────────────────

router.get('/list', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const expiring = req.query.expiring === 'true';

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const where = {
      ...(status && { status: status as never }),
      ...(type && { organization: { type: type as never } }),
      ...(expiring && { status: { in: ['ACTIVE', 'TRIAL'] as never }, endDate: { lte: in30Days, gte: now } }),
    };

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          organization: { select: { id: true, name: true, type: true, email: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);
    sendPaginated(res, subs, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        organization: true,
        history: { orderBy: { createdAt: 'desc' }, include: { previousPlan: true, newPlan: true } },
      },
    });
    if (!sub) throw new AppError('Subscription not found', 404);
    sendSuccess(res, sub);
  } catch (err) { next(err); }
});

router.get('/organization/:orgId/payments', async (req, res, next) => {
  try {
    const orgId = paramId(req.params.orgId);
    const payments = await prisma.payment.findMany({
      where: { bill: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { bill: { select: { billNumber: true, patient: { select: { fullName: true } } } } },
    });
    sendSuccess(res, payments);
  } catch (err) { next(err); }
});

// ─── Subscription actions ────────────────────────────────────────────────────

const editSubSchema = z.object({
  planId: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'TRIAL', 'SUSPENDED']).optional(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  price: z.number().optional(),
  discount: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  trialEndsAt: z.string().optional(),
  reason: z.string().optional(),
});

router.patch('/:id', validateBody(editSubSchema), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { reason, ...updates } = req.body;

    const existing = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const data: Record<string, unknown> = { ...updates, changeSource: 'MANUAL' };
    if (updates.startDate) data.startDate = new Date(updates.startDate);
    if (updates.endDate) data.endDate = new Date(updates.endDate);
    if (updates.trialEndsAt) data.trialEndsAt = new Date(updates.trialEndsAt);

    const sub = await prisma.subscription.update({ where: { id }, data, include: { plan: true, organization: { select: { name: true, type: true } } } });

    await recordHistory(id, existing.organizationId, {
      previousPlanId: existing.planId,
      newPlanId: updates.planId || existing.planId,
      previousPrice: existing.price ?? existing.plan.monthlyPrice,
      newPrice: updates.price ?? sub.price ?? sub.plan.monthlyPrice,
      previousStatus: existing.status,
      newStatus: sub.status,
      reason: reason || 'Manual update by admin',
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    await logAudit(req, 'UPDATE', 'Subscription', id, { ...updates, reason });

    sendSuccess(res, sub, 'Subscription updated');
  } catch (err) { next(err); }
});

router.post('/:id/extend', validateBody(z.object({ days: z.number().int().min(1), reason: z.string().optional() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { days, reason } = req.body;
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const base = existing.endDate && existing.endDate > new Date() ? existing.endDate : new Date();
    const endDate = new Date(base);
    endDate.setDate(endDate.getDate() + days);

    const sub = await prisma.subscription.update({ where: { id }, data: { endDate, status: 'ACTIVE', changeSource: 'MANUAL' }, include: { plan: true, organization: { select: { name: true, type: true } } } });

    await recordHistory(id, existing.organizationId, {
      previousStatus: existing.status,
      newStatus: 'ACTIVE',
      reason: reason || `Extended by ${days} days`,
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    sendSuccess(res, sub, `Extended by ${days} days`);
  } catch (err) { next(err); }
});

router.post('/:id/suspend', validateBody(z.object({ reason: z.string().min(3) })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { reason } = req.body;
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const sub = await prisma.subscription.update({
      where: { id },
      data: { status: 'SUSPENDED', suspendReason: reason, changeSource: 'MANUAL' },
      include: { plan: true, organization: { select: { name: true, type: true } } },
    });

    await recordHistory(id, existing.organizationId, {
      previousStatus: existing.status,
      newStatus: 'SUSPENDED',
      reason,
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    await logAudit(req, 'SUSPEND', 'Subscription', id, { reason });
    sendSuccess(res, sub, 'Subscription suspended');
  } catch (err) { next(err); }
});

router.post('/:id/activate', validateBody(z.object({ reason: z.string().optional() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const sub = await prisma.subscription.update({
      where: { id },
      data: { status: 'ACTIVE', suspendReason: null, changeSource: 'MANUAL' },
      include: { plan: true, organization: { select: { name: true, type: true } } },
    });

    await recordHistory(id, existing.organizationId, {
      previousStatus: existing.status,
      newStatus: 'ACTIVE',
      reason: req.body.reason || 'Reactivated by admin',
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    sendSuccess(res, sub, 'Subscription activated');
  } catch (err) { next(err); }
});

router.post('/:id/cancel', validateBody(z.object({ reason: z.string().optional() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const sub = await prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED', changeSource: 'MANUAL' },
      include: { plan: true, organization: { select: { name: true, type: true } } },
    });

    await recordHistory(id, existing.organizationId, {
      previousStatus: existing.status,
      newStatus: 'CANCELLED',
      reason: req.body.reason || 'Cancelled by admin',
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    sendSuccess(res, sub, 'Subscription cancelled');
  } catch (err) { next(err); }
});

router.post('/:id/renew', validateBody(z.object({ billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(), reason: z.string().optional() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const cycle = req.body.billingCycle || existing.billingCycle;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (cycle === 'YEARLY' ? 12 : 1));

    const sub = await prisma.subscription.update({
      where: { id },
      data: { status: 'ACTIVE', billingCycle: cycle, endDate, startDate: new Date(), changeSource: 'MANUAL' },
      include: { plan: true, organization: { select: { name: true, type: true } } },
    });

    await recordHistory(id, existing.organizationId, {
      previousStatus: existing.status,
      newStatus: 'ACTIVE',
      reason: req.body.reason || 'Renewed by admin',
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    sendSuccess(res, sub, 'Subscription renewed');
  } catch (err) { next(err); }
});

router.post('/:id/reset-default', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const defaultPlan = await prisma.subscriptionPlan.findFirst({ where: { isDefault: true } });
    if (!defaultPlan) throw new AppError('No default plan configured', 400);

    const existing = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!existing) throw new AppError('Subscription not found', 404);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const sub = await prisma.subscription.update({
      where: { id },
      data: {
        planId: defaultPlan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        price: defaultPlan.monthlyPrice,
        endDate,
        suspendReason: null,
        changeSource: 'MANUAL',
      },
      include: { plan: true, organization: { select: { name: true, type: true } } },
    });

    await recordHistory(id, existing.organizationId, {
      previousPlanId: existing.planId,
      newPlanId: defaultPlan.id,
      previousPrice: existing.price ?? existing.plan.monthlyPrice,
      newPrice: defaultPlan.monthlyPrice,
      previousStatus: existing.status,
      newStatus: 'ACTIVE',
      reason: 'Reset to default plan',
      changeSource: 'MANUAL',
      changedById: req.user?.userId,
      changedByEmail: req.user?.email,
    });
    sendSuccess(res, sub, 'Reset to default plan');
  } catch (err) { next(err); }
});

// ─── History (platform-wide) ─────────────────────────────────────────────────

router.get('/history/all', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const [history, total] = await Promise.all([
      prisma.subscriptionHistory.findMany({
        skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { previousPlan: true, newPlan: true },
      }),
      prisma.subscriptionHistory.count(),
    ]);
    sendPaginated(res, history, { page, limit, total });
  } catch (err) { next(err); }
});

export default router;
