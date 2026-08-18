import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/subscriptions/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
    sendSuccess(res, plans);
  } catch (err) {
    next(err);
  }
});

router.get('/subscriptions', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          organization: { select: { id: true, name: true, type: true } },
        },
      }),
      prisma.subscription.count(),
    ]);

    sendPaginated(res, subscriptions, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get('/advertisements', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const where = status ? { status: status as never } : {};

    const [ads, total] = await Promise.all([
      prisma.advertisement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { organization: { select: { name: true } } },
      }),
      prisma.advertisement.count({ where }),
    ]);

    sendPaginated(res, ads, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.patch('/advertisements/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED'];
    if (!valid.includes(status)) throw new AppError('Invalid status', 400);

    const id = paramId(req.params.id);
    const ad = await prisma.advertisement.update({
      where: { id },
      data: { status },
    });

    sendSuccess(res, ad);
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, role: true } } },
      }),
      prisma.auditLog.count(),
    ]);

    sendPaginated(res, logs, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

export default router;
