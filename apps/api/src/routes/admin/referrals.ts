import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import { getReferralAnalytics } from '../../services/analytics/referral-analytics';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [ashaCount, partnerCount, campaigns, commissions, analytics] = await Promise.all([
      prisma.ashaProfile.count(),
      prisma.referralPartner.count(),
      prisma.referralCampaign.count({ where: { isActive: true } }),
      prisma.referralCommission.groupBy({
        by: ['status'],
        _sum: { commissionAmount: true },
        _count: true,
      }),
      getReferralAnalytics(),
    ]);
    sendSuccess(res, {
      ashaCount,
      partnerCount,
      activeCampaigns: campaigns,
      commissions,
      analytics,
    });
  } catch (err) { next(err); }
});

router.get('/asha', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.ashaProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { connections: true, commissions: true } } },
      }),
      prisma.ashaProfile.count({ where }),
    ]);
    sendPaginated(res, items, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/partners', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.referralPartner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { connections: true, commissions: true } } },
      }),
      prisma.referralPartner.count({ where }),
    ]);
    sendPaginated(res, items, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/commissions', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.referralCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { fullName: true } },
          organization: { select: { name: true } },
          ashaProfile: { select: { ashaName: true, ashaId: true } },
          referralPartner: { select: { referralPartnerName: true, referralId: true } },
        },
      }),
      prisma.referralCommission.count({ where }),
    ]);
    sendPaginated(res, items, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/commissions/:id/status', validateBody(z.object({
  status: z.enum(['APPROVED', 'PAYABLE', 'PAID', 'REJECTED', 'ON_HOLD']),
  holdReason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const data: Record<string, unknown> = { status: req.body.status };
    if (req.body.status === 'APPROVED') data.approvedAt = new Date();
    if (req.body.status === 'PAID') data.paidAt = new Date();
    if (req.body.holdReason) data.holdReason = req.body.holdReason;
    const commission = await prisma.referralCommission.update({ where: { id }, data });
    await logAudit(req, 'UPDATE', 'ReferralCommission', id, req.body);
    sendSuccess(res, commission);
  } catch (err) { next(err); }
});

router.patch('/asha/:id/status', validateBody(z.object({ status: z.string() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.ashaProfile.update({ where: { id }, data: { status: req.body.status } });
    await logAudit(req, 'UPDATE', 'AshaProfile', id, req.body);
    sendSuccess(res, profile);
  } catch (err) { next(err); }
});

router.patch('/partners/:id/status', validateBody(z.object({ status: z.string() })), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.referralPartner.update({ where: { id }, data: { status: req.body.status } });
    await logAudit(req, 'UPDATE', 'ReferralPartner', id, req.body);
    sendSuccess(res, profile);
  } catch (err) { next(err); }
});

router.get('/attributions', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const orgId = req.query.organizationId as string | undefined;
    const where = orgId ? { organizationId: orgId } : {};
    const [items, total] = await Promise.all([
      prisma.patientReferralAttribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { fullName: true } },
          organization: { select: { name: true } },
          ashaProfile: { select: { ashaName: true } },
          referralPartner: { select: { referralPartnerName: true } },
        },
      }),
      prisma.patientReferralAttribution.count({ where }),
    ]);
    sendPaginated(res, items, { page, limit, total });
  } catch (err) { next(err); }
});

export default router;
