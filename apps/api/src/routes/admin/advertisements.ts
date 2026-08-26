import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import {
  logAdHistory,
  syncAdStatuses,
  checkAdvertiserVerified,
  REJECTION_REASONS,
  AD_TYPE_LABELS,
} from '../../lib/ads';
import { getEmergencyState } from '../../lib/emergency';

const router = Router();

const adBodySchema = z.object({
  organizationId: z.string().optional(),
  doctorId: z.string().optional(),
  campaignName: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  type: z.string(),
  imageUrl: z.string().optional(),
  mobileImageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  ctaText: z.string().optional(),
  targetUrl: z.string().optional(),
  landingType: z.string().optional(),
  landingId: z.string().optional(),
  targetCities: z.array(z.string()).optional(),
  targetStates: z.array(z.string()).optional(),
  targetPinCodes: z.array(z.string()).optional(),
  targetRadiusKm: z.number().optional(),
  audienceType: z.string().optional(),
  healthcareCategories: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  dailyBudget: z.number().optional(),
  pricingModel: z.string().optional(),
  adPlanId: z.string().optional(),
  priority: z.number().optional(),
  placement: z.string().optional(),
  paymentStatus: z.string().optional(),
  paidAmount: z.number().optional(),
});

function parseDates<T extends { startDate?: string; endDate?: string }>(body: T) {
  return {
    ...body,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
  };
}

const adInclude = {
  organization: { select: { id: true, name: true, type: true, city: true, verificationStatus: true } },
  doctor: { select: { id: true, fullName: true, specialization: true } },
  adPlan: true,
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    await syncAdStatuses();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total, active, pending, rejected, scheduled, expired,
      agg, todayAgg, totalLeads, totalBookings, revenue,
    ] = await Promise.all([
      prisma.advertisement.count(),
      prisma.advertisement.count({ where: { status: 'ACTIVE', isPaused: false } }),
      prisma.advertisement.count({ where: { status: 'PENDING' } }),
      prisma.advertisement.count({ where: { status: 'REJECTED' } }),
      prisma.advertisement.count({ where: { status: 'SCHEDULED' } }),
      prisma.advertisement.count({ where: { status: 'EXPIRED' } }),
      prisma.advertisement.aggregate({ _sum: { impressions: true, clicks: true, conversions: true, paidAmount: true } }),
      prisma.advertisement.aggregate({
        where: { updatedAt: { gte: today } },
        _sum: { impressions: true, clicks: true },
      }),
      prisma.lead.count({ where: { source: 'Advertisement' } }),
      prisma.advertisement.aggregate({ _sum: { appointments: true } }),
      prisma.advertisement.aggregate({ _sum: { paidAmount: true, budget: true } }),
    ]);

    const impressions = agg._sum.impressions || 0;
    const clicks = agg._sum.clicks || 0;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0';
    const conversions = agg._sum.conversions || 0;
    const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : '0';

    sendSuccess(res, {
      totalAdvertisements: total,
      activeCampaigns: active,
      pendingApproval: pending,
      rejectedAds: rejected,
      scheduledAds: scheduled,
      expiredAds: expired,
      totalImpressions: impressions,
      totalClicks: clicks,
      totalLeads,
      totalBookings: totalBookings._sum.appointments || 0,
      totalAdRevenue: revenue._sum.paidAmount || 0,
      totalBudget: revenue._sum.budget || 0,
      conversionRate: `${conversionRate}%`,
      ctr: `${ctr}%`,
      todayImpressions: todayAgg._sum.impressions || 0,
      todayClicks: todayAgg._sum.clicks || 0,
      adTypeLabels: AD_TYPE_LABELS,
      rejectionReasons: REJECTION_REASONS,
    });
  } catch (err) { next(err); }
});

// ─── Revenue Analytics ───────────────────────────────────────────────────────

router.get('/revenue-analytics', async (_req, res, next) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { paidAmount: { gt: 0 } },
      include: { organization: { select: { name: true, city: true } } },
    });

    const byType: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const byAdvertiser: Record<string, number> = {};
    let total = 0;

    for (const ad of ads) {
      total += ad.paidAmount || 0;
      byType[ad.type] = (byType[ad.type] || 0) + (ad.paidAmount || 0);
      const city = ad.organization?.city || 'Unknown';
      byCity[city] = (byCity[city] || 0) + (ad.paidAmount || 0);
      const adv = ad.organization?.name || 'Platform';
      byAdvertiser[adv] = (byAdvertiser[adv] || 0) + (ad.paidAmount || 0);
    }

    sendSuccess(res, { total, byType, byCity, byAdvertiser });
  } catch (err) { next(err); }
});

// ─── Ad Plans ────────────────────────────────────────────────────────────────

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.adPlan.findMany({ orderBy: { price: 'asc' } });
    sendSuccess(res, plans);
  } catch (err) { next(err); }
});

router.post('/plans', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string(), adType: z.string(), price: z.number(), durationDays: z.number(),
      pricingModel: z.string().optional(), description: z.string().optional(),
      placement: z.string().optional(), priority: z.number().optional(),
      recommendedDimensions: z.unknown().optional(),
    }).parse(req.body);
    const plan = await prisma.adPlan.create({ data: body as Prisma.AdPlanCreateInput });
    sendSuccess(res, plan, 'Ad plan created');
  } catch (err) { next(err); }
});

router.patch('/plans/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const plan = await prisma.adPlan.update({ where: { id }, data: req.body });
    sendSuccess(res, plan);
  } catch (err) { next(err); }
});

router.delete('/plans/:id', async (req, res, next) => {
  try {
    await prisma.adPlan.update({ where: { id: paramId(req.params.id) }, data: { isActive: false } });
    sendSuccess(res, null, 'Plan deactivated');
  } catch (err) { next(err); }
});

// ─── Emergency Controls ──────────────────────────────────────────────────────

router.get('/emergency', async (_req, res, next) => {
  try {
    const state = await getEmergencyState();
    const modules = (state.modules || {}) as Record<string, boolean>;
    sendSuccess(res, {
      pauseAllAds: !modules.advertisement,
      disableNewAds: modules.advertisement === false,
    });
  } catch (err) { next(err); }
});

router.post('/emergency/pause-all', async (req: AuthRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(3) }).parse(req.body);
    const result = await prisma.advertisement.updateMany({
      where: { status: 'ACTIVE' },
      data: { isPaused: true, status: 'PAUSED' },
    });
    sendSuccess(res, { paused: result.count }, 'All active ads paused');
  } catch (err) { next(err); }
});

router.post('/emergency/resume-all', async (req: AuthRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(3) }).parse(req.body);
    const now = new Date();
    const paused = await prisma.advertisement.findMany({ where: { isPaused: true, status: 'PAUSED' } });
    let resumed = 0;
    for (const ad of paused) {
      const newStatus = ad.endDate && ad.endDate < now ? 'EXPIRED' : 'ACTIVE';
      await prisma.advertisement.update({ where: { id: ad.id }, data: { isPaused: false, status: newStatus } });
      await logAdHistory(ad.id, 'RESUMED', { performedByEmail: req.user?.email, reason });
      resumed++;
    }
    sendSuccess(res, { resumed });
  } catch (err) { next(err); }
});

// ─── Advertisers ─────────────────────────────────────────────────────────────

router.get('/advertisers', async (_req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { advertisements: { some: {} } },
      select: {
        id: true, name: true, type: true, city: true, verificationStatus: true,
        _count: { select: { advertisements: true } },
      },
      take: 50,
    });
    sendSuccess(res, orgs);
  } catch (err) { next(err); }
});

// ─── Leads & Conversions ───────────────────────────────────────────────────────

router.get('/leads', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: { advertisementId: { not: null } },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { name: true } },
          advertisement: { select: { title: true, campaignName: true } },
        },
      }),
      prisma.lead.count({ where: { advertisementId: { not: null } } }),
    ]);
    sendPaginated(res, leads, { page, limit, total });
  } catch (err) { next(err); }
});

// ─── List / Filter ───────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    await syncAdStatuses();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const orgType = req.query.orgType as string | undefined;
    const paymentStatus = req.query.paymentStatus as string | undefined;
    const city = req.query.city as string | undefined;

    const where: Prisma.AdvertisementWhereInput = {
      ...(status && { status: status as never }),
      ...(type && { type: type as never }),
      ...(paymentStatus && { paymentStatus: paymentStatus as never }),
      ...(city && { targetCities: { has: city } }),
      ...(orgType && { organization: { type: orgType as never } }),
    };

    const [ads, total] = await Promise.all([
      prisma.advertisement.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: adInclude,
      }),
      prisma.advertisement.count({ where }),
    ]);
    sendPaginated(res, ads, { page, limit, total });
  } catch (err) { next(err); }
});

// ─── Create ──────────────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = parseDates(adBodySchema.parse(req.body));
    if (body.organizationId && !(await checkAdvertiserVerified(body.organizationId))) {
      res.status(400).json({ success: false, message: 'Advertiser must be verified before creating ads' });
      return;
    }

    const now = new Date();
    let status: 'PENDING' | 'SCHEDULED' | 'ACTIVE' = 'PENDING';
    if (body.startDate && body.startDate > now) status = 'SCHEDULED';
    else if (req.body.autoApprove) status = 'ACTIVE';

    const ad = await prisma.advertisement.create({
      data: {
        ...body,
        type: body.type as never,
        pricingModel: (body.pricingModel || 'FIXED') as never,
        paymentStatus: (body.paymentStatus || 'UNPAID') as never,
        status,
        createdByEmail: req.user?.email,
        healthcareCategories: body.healthcareCategories || [],
        targetCities: body.targetCities || [],
        targetStates: body.targetStates || [],
        targetPinCodes: body.targetPinCodes || [],
        platforms: body.platforms || ['website'],
      },
      include: adInclude,
    });

    await logAdHistory(ad.id, 'CREATED', { performedByEmail: req.user?.email });
    sendSuccess(res, ad, 'Advertisement created');
  } catch (err) { next(err); }
});

// ─── Single ad ───────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const ad = await prisma.advertisement.findUnique({
      where: { id: paramId(req.params.id) },
      include: { ...adInclude, history: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!ad) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    sendSuccess(res, ad);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const body = parseDates(adBodySchema.partial().parse(req.body));
    const ad = await prisma.advertisement.update({
      where: { id },
      data: body as Prisma.AdvertisementUpdateInput,
      include: adInclude,
    });
    await logAdHistory(id, 'EDITED', { performedByEmail: req.user?.email });
    sendSuccess(res, ad);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await logAdHistory(id, 'DELETED', { performedByEmail: req.user?.email });
    await prisma.advertisement.delete({ where: { id } });
    sendSuccess(res, null, 'Deleted');
  } catch (err) { next(err); }
});

// ─── Approval workflow ───────────────────────────────────────────────────────

router.post('/:id/approve', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ad = await prisma.advertisement.findUnique({ where: { id } });
    if (!ad) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    if (ad.organizationId && !(await checkAdvertiserVerified(ad.organizationId))) {
      res.status(400).json({ success: false, message: 'Cannot approve — advertiser is not verified' });
      return;
    }

    const now = new Date();
    const status = ad.startDate && ad.startDate > now ? 'SCHEDULED' : 'ACTIVE';
    const updated = await prisma.advertisement.update({
      where: { id },
      data: { status, approvedByEmail: req.user?.email, approvedAt: now, rejectionReason: null },
      include: adInclude,
    });
    await logAdHistory(id, 'APPROVED', { performedByEmail: req.user?.email });
    sendSuccess(res, updated, 'Advertisement approved');
  } catch (err) { next(err); }
});

router.post('/:id/reject', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { reason } = z.object({ reason: z.string().min(10) }).parse(req.body);
    const updated = await prisma.advertisement.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason },
      include: adInclude,
    });
    await logAdHistory(id, 'REJECTED', { performedByEmail: req.user?.email, reason });
    sendSuccess(res, updated, 'Advertisement rejected');
  } catch (err) { next(err); }
});

router.post('/:id/request-changes', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { reason } = z.object({ reason: z.string().min(10) }).parse(req.body);
    const updated = await prisma.advertisement.update({
      where: { id },
      data: { status: 'CHANGES_REQUESTED', rejectionReason: reason },
      include: adInclude,
    });
    await logAdHistory(id, 'CHANGES_REQUESTED', { performedByEmail: req.user?.email, reason });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Lifecycle actions ───────────────────────────────────────────────────────

router.post('/:id/pause', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const updated = await prisma.advertisement.update({
      where: { id },
      data: { isPaused: true, status: 'PAUSED' },
      include: adInclude,
    });
    await logAdHistory(id, 'PAUSED', { performedByEmail: req.user?.email });
    sendSuccess(res, updated, 'Campaign paused');
  } catch (err) { next(err); }
});

router.post('/:id/resume', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const ad = await prisma.advertisement.findUnique({ where: { id } });
    const now = new Date();
    const status = ad?.endDate && ad.endDate < now ? 'EXPIRED' : 'ACTIVE';
    const updated = await prisma.advertisement.update({
      where: { id },
      data: { isPaused: false, status },
      include: adInclude,
    });
    await logAdHistory(id, 'RESUMED', { performedByEmail: req.user?.email });
    sendSuccess(res, updated, 'Campaign resumed');
  } catch (err) { next(err); }
});

router.post('/:id/duplicate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const original = await prisma.advertisement.findUnique({ where: { id } });
    if (!original) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    const { id: _id, createdAt, updatedAt, approvedAt, approvedByEmail, impressions, clicks, uniqueImpressions, leads, appointments, conversions, profileViews, callClicks, whatsappClicks, ...data } = original;
    const copy = await prisma.advertisement.create({
      data: { ...data, title: `${data.title} (Copy)`, status: 'PENDING', isPaused: false, createdByEmail: req.user?.email },
      include: adInclude,
    });
    await logAdHistory(copy.id, 'DUPLICATED', { performedByEmail: req.user?.email, details: { fromId: id } });
    sendSuccess(res, copy);
  } catch (err) { next(err); }
});

router.post('/:id/extend', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { endDate } = z.object({ endDate: z.string() }).parse(req.body);
    const updated = await prisma.advertisement.update({
      where: { id },
      data: { endDate: new Date(endDate), status: 'ACTIVE', isPaused: false },
      include: adInclude,
    });
    await logAdHistory(id, 'EXTENDED', { performedByEmail: req.user?.email, details: { endDate } });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Analytics ───────────────────────────────────────────────────────────────

router.get('/:id/analytics', async (req, res, next) => {
  try {
    const ad = await prisma.advertisement.findUnique({ where: { id: paramId(req.params.id) } });
    if (!ad) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0';
    const convRate = ad.clicks > 0 ? ((ad.conversions / ad.clicks) * 100).toFixed(1) : '0';
    sendSuccess(res, {
      impressions: ad.impressions,
      uniqueImpressions: ad.uniqueImpressions,
      clicks: ad.clicks,
      ctr: `${ctr}%`,
      leads: ad.leads,
      appointments: ad.appointments,
      conversions: ad.conversions,
      conversionRate: `${convRate}%`,
      profileViews: ad.profileViews,
      callClicks: ad.callClicks,
      whatsappClicks: ad.whatsappClicks,
      billing: {
        budget: ad.budget,
        paidAmount: ad.paidAmount,
        pendingAmount: ad.pendingAmount,
        campaignCost: ad.campaignCost,
        paymentStatus: ad.paymentStatus,
      },
    });
  } catch (err) { next(err); }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await prisma.adHistory.findMany({
      where: { advertisementId: paramId(req.params.id) },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, history);
  } catch (err) { next(err); }
});

export default router;
