import { Router } from 'express';
import { z } from 'zod';
import { AutomationModule } from '@prisma/client';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { prisma } from '../../lib/prisma';
import { paramId } from '../../lib/params';
import { getJobStats } from '../../services/jobs/queue';
import { seedDefaultAutomations } from '../../services/automation/engine';
import { logAudit } from '../../lib/audit';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/rules', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const [rules, total] = await Promise.all([
      prisma.automationRule.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.automationRule.count(),
    ]);
    sendPaginated(res, rules, { page, limit, total });
  } catch (err) { next(err); }
});

router.post('/rules', validateBody(z.object({
  name: z.string().min(1),
  module: z.nativeEnum(AutomationModule).optional(),
  trigger: z.string().min(1),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
  actions: z.array(z.object({
    type: z.string(),
  }).passthrough()).min(1),
  delayMinutes: z.number().optional(),
  schedule: z.string().optional(),
  channel: z.string().optional(),
  audience: z.string().optional(),
  isActive: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const rule = await prisma.automationRule.create({ data: req.body });
    await logAudit(req, 'CREATE', 'AutomationRule', rule.id);
    sendSuccess(res, rule, 'Automation created', 201);
  } catch (err) { next(err); }
});

router.patch('/rules/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const rule = await prisma.automationRule.update({ where: { id }, data: req.body });
    await logAudit(req, 'UPDATE', 'AutomationRule', id);
    sendSuccess(res, rule, 'Automation updated');
  } catch (err) { next(err); }
});

router.delete('/rules/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.automationRule.delete({ where: { id } });
    await logAudit(req, 'DELETE', 'AutomationRule', id);
    sendSuccess(res, null, 'Automation deleted');
  } catch (err) { next(err); }
});

router.get('/executions', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [executions, total] = await Promise.all([
      prisma.automationExecution.findMany({
        skip, take: limit, orderBy: { ranAt: 'desc' },
        include: { rule: { select: { name: true, trigger: true } } },
      }),
      prisma.automationExecution.count(),
    ]);
    sendPaginated(res, executions, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/jobs/stats', async (_req, res, next) => {
  try {
    const stats = await getJobStats();
    sendSuccess(res, stats);
  } catch (err) { next(err); }
});

router.post('/seed-defaults', requireRoles('SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await seedDefaultAutomations();
    await logAudit(req, 'SEED', 'AutomationRule');
    sendSuccess(res, null, 'Default automations seeded');
  } catch (err) { next(err); }
});

export default router;
