import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, ORG_ADMIN_ROLES } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { requireOrgId, assertOrgAdmin } from '../../lib/crm-tenant';
import { logCrmAudit } from '../../lib/crm-audit';
import {
  generateReferralCode, generateAshaId, generateReferralId,
  buildReferralLink, buildQrCodeUrl,
} from '../../lib/referral';
import { trackReferralEvent } from '../../lib/referral-service';

const router = Router();
router.use(authenticate, requireRoles(...CRM_ROLES));

const pagination = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(['ASHA', 'REFERRAL_PARTNER']).optional(),
  status: z.string().optional(),
});

async function createDefaultCampaign(opts: {
  organizationId: string;
  ashaProfileId?: string;
  referralPartnerId?: string;
  name: string;
  code: string;
}) {
  const link = buildReferralLink(opts.code);
  const qrCodeUrl = buildQrCodeUrl(link);
  const campaign = await prisma.referralCampaign.create({
    data: {
      organizationId: opts.organizationId,
      ashaProfileId: opts.ashaProfileId,
      referralPartnerId: opts.referralPartnerId,
      name: opts.name,
      referralCode: opts.code,
      referralLink: link,
      qrCodeUrl,
    },
  });
  await trackReferralEvent({
    eventType: 'LINK_GENERATED',
    ashaProfileId: opts.ashaProfileId,
    referralPartnerId: opts.referralPartnerId,
    organizationId: opts.organizationId,
    campaignId: campaign.id,
  });
  return campaign;
}

// ─── Dashboard / Overview ────────────────────────────────────────────────────

router.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const [ashaCount, partnerCount, referredPatients, pendingCommission, paidCommission, topPerformers] = await Promise.all([
      prisma.referralHospitalConnection.count({ where: { organizationId: orgId, ashaProfileId: { not: null }, status: 'ACTIVE' } }),
      prisma.referralHospitalConnection.count({ where: { organizationId: orgId, referralPartnerId: { not: null }, status: 'ACTIVE' } }),
      prisma.patientReferralAttribution.count({ where: { organizationId: orgId, sourceType: { in: ['ASHA', 'REFERRAL_PARTNER', 'CAMPAIGN'] } } }),
      prisma.referralCommission.aggregate({ where: { organizationId: orgId, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } }, _sum: { commissionAmount: true } }),
      prisma.referralCommission.aggregate({ where: { organizationId: orgId, status: 'PAID' }, _sum: { commissionAmount: true } }),
      prisma.referralCommission.groupBy({
        by: ['ashaProfileId', 'referralPartnerId'],
        where: { organizationId: orgId },
        _sum: { commissionAmount: true },
        _count: true,
        orderBy: { _sum: { commissionAmount: 'desc' } },
        take: 5,
      }),
    ]);
    sendSuccess(res, {
      ashaCount, partnerCount, referredPatients,
      pendingCommission: pendingCommission._sum.commissionAmount || 0,
      paidCommission: paidCommission._sum.commissionAmount || 0,
      topPerformers,
    });
  } catch (err) { next(err); }
});

// ─── List all referrals (AASHA + Partners) ─────────────────────────────────

router.get('/', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { type, status } = req.query as unknown as { type?: string; status?: string };

    const connections = await prisma.referralHospitalConnection.findMany({
      where: {
        organizationId: orgId,
        ...(type === 'ASHA' ? { ashaProfileId: { not: null } } : {}),
        ...(type === 'REFERRAL_PARTNER' ? { referralPartnerId: { not: null } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        ashaProfile: true,
        referralPartner: true,
        commissionPlan: true,
      },
      orderBy: { connectionDate: 'desc' },
    });

    const items = connections.map((c) => ({
      id: c.id,
      type: c.ashaProfileId ? 'ASHA' : 'REFERRAL_PARTNER',
      ashaProfile: c.ashaProfile,
      referralPartner: c.referralPartner,
      connectionDate: c.connectionDate,
      status: c.status,
      totalPatients: c.totalPatients,
      totalTreatments: c.totalTreatments,
      totalCommission: c.totalCommission,
      commissionPlan: c.commissionPlan,
    }));

    sendSuccess(res, items);
  } catch (err) { next(err); }
});

// ─── Create AASHA ────────────────────────────────────────────────────────────

router.post('/asha', validateBody(z.object({
  ashaName: z.string().min(2),
  ashaPhoto: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  idProofUrl: z.string().optional(),
  joiningDate: z.string().optional(),
  commissionPlanId: z.string().optional(),
  createLogin: z.boolean().optional(),
  password: z.string().min(8).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const ashaId = generateAshaId();
    const code = generateReferralCode('AASHA', req.body.ashaName);

    let userId: string | undefined;
    if (req.body.createLogin && req.body.email && req.body.password) {
      const passwordHash = await hashPassword(req.body.password);
      const user = await prisma.user.create({
        data: { email: req.body.email, passwordHash, role: 'ASHA', phone: req.body.mobile },
      });
      userId = user.id;
    }

    const asha = await prisma.ashaProfile.create({
      data: {
        userId,
        ashaId,
        ashaName: req.body.ashaName,
        ashaPhoto: req.body.ashaPhoto,
        mobile: req.body.mobile,
        email: req.body.email,
        address: req.body.address,
        area: req.body.area,
        village: req.body.village,
        district: req.body.district,
        state: req.body.state,
        pinCode: req.body.pinCode,
        idProofUrl: req.body.idProofUrl,
        joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : new Date(),
        status: 'PENDING',
      },
    });

    await prisma.referralHospitalConnection.create({
      data: {
        organizationId: orgId,
        ashaProfileId: asha.id,
        commissionPlanId: req.body.commissionPlanId,
        status: 'PENDING',
      },
    });

    await prisma.referralWallet.create({ data: { ashaProfileId: asha.id } });
    const campaign = await createDefaultCampaign({
      organizationId: orgId,
      ashaProfileId: asha.id,
      name: `${req.body.ashaName} - General`,
      code,
    });

    await logCrmAudit(req, orgId, 'CREATE', 'AshaProfile', asha.id, { ashaName: req.body.ashaName });
    sendSuccess(res, { ...asha, referralCode: code, referralLink: campaign.referralLink, qrCodeUrl: campaign.qrCodeUrl }, 'AASHA profile created', 201);
  } catch (err) { next(err); }
});

// ─── Create Referral Partner ─────────────────────────────────────────────────

router.post('/partners', validateBody(z.object({
  referralPartnerName: z.string().min(2),
  referralPhoto: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  idProofUrl: z.string().optional(),
  commissionPlanId: z.string().optional(),
  createLogin: z.boolean().optional(),
  password: z.string().min(8).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const referralId = generateReferralId();
    const code = generateReferralCode('REF', req.body.referralPartnerName);

    let userId: string | undefined;
    if (req.body.createLogin && req.body.email && req.body.password) {
      const passwordHash = await hashPassword(req.body.password);
      const user = await prisma.user.create({
        data: { email: req.body.email, passwordHash, role: 'REFERRAL_PARTNER', phone: req.body.mobile },
      });
      userId = user.id;
    }

    const partner = await prisma.referralPartner.create({
      data: {
        userId,
        referralId,
        referralPartnerName: req.body.referralPartnerName,
        referralPhoto: req.body.referralPhoto,
        mobile: req.body.mobile,
        email: req.body.email,
        address: req.body.address,
        area: req.body.area,
        district: req.body.district,
        state: req.body.state,
        pinCode: req.body.pinCode,
        idProofUrl: req.body.idProofUrl,
        referralCode: code,
        status: 'PENDING',
      },
    });

    await prisma.referralHospitalConnection.create({
      data: {
        organizationId: orgId,
        referralPartnerId: partner.id,
        commissionPlanId: req.body.commissionPlanId,
        status: 'PENDING',
      },
    });

    await prisma.referralWallet.create({ data: { referralPartnerId: partner.id } });
    const campaign = await createDefaultCampaign({
      organizationId: orgId,
      referralPartnerId: partner.id,
      name: `${req.body.referralPartnerName} - General`,
      code,
    });

    await logCrmAudit(req, orgId, 'CREATE', 'ReferralPartner', partner.id, { referralPartnerName: req.body.referralPartnerName });
    sendSuccess(res, { ...partner, referralLink: campaign.referralLink, qrCodeUrl: campaign.qrCodeUrl }, 'Referral partner created', 201);
  } catch (err) { next(err); }
});

// ─── Approve / Suspend ───────────────────────────────────────────────────────

router.patch('/connections/:id', validateBody(z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DISCONNECTED']).optional(),
  commissionPlanId: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.referralHospitalConnection.updateMany({
      where: { id, organizationId: orgId },
      data: req.body,
    });
    if (!result.count) throw new AppError('Connection not found', 404);

    const conn = await prisma.referralHospitalConnection.findUnique({ where: { id } });
    if (conn?.status === 'ACTIVE') {
      if (conn.ashaProfileId) {
        await prisma.ashaProfile.update({ where: { id: conn.ashaProfileId }, data: { status: 'ACTIVE' } });
      }
      if (conn.referralPartnerId) {
        await prisma.referralPartner.update({ where: { id: conn.referralPartnerId }, data: { status: 'ACTIVE' } });
      }
    }

    await logCrmAudit(req, orgId, 'UPDATE', 'ReferralConnection', id, req.body);
    sendSuccess(res, { id }, 'Connection updated');
  } catch (err) { next(err); }
});

// ─── Campaigns ───────────────────────────────────────────────────────────────

router.get('/campaigns', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const campaigns = await prisma.referralCampaign.findMany({
      where: { organizationId: orgId },
      include: { ashaProfile: { select: { ashaId: true, ashaName: true } }, referralPartner: { select: { referralId: true, referralPartnerName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, campaigns);
  } catch (err) { next(err); }
});

router.post('/campaigns', validateBody(z.object({
  name: z.string().min(2),
  ashaProfileId: z.string().optional(),
  referralPartnerId: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const code = generateReferralCode('CAMP', req.body.name);
    const campaign = await createDefaultCampaign({ organizationId: orgId, ...req.body, name: req.body.name, code });
    sendSuccess(res, campaign, 'Campaign created', 201);
  } catch (err) { next(err); }
});

// ─── Referred Patients ───────────────────────────────────────────────────────

router.get('/patients', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const where = { organizationId: orgId, sourceType: { in: ['ASHA', 'REFERRAL_PARTNER', 'CAMPAIGN'] as ('ASHA' | 'REFERRAL_PARTNER' | 'CAMPAIGN')[] } };
    const [items, total] = await Promise.all([
      prisma.patientReferralAttribution.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: { select: { id: true, fullName: true, user: { select: { phone: true } } } },
          ashaProfile: { select: { ashaId: true, ashaName: true } },
          referralPartner: { select: { referralId: true, referralPartnerName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patientReferralAttribution.count({ where }),
    ]);
    sendPaginated(res, items, { page, limit, total });
  } catch (err) { next(err); }
});

// ─── Commissions ─────────────────────────────────────────────────────────────

router.get('/commissions', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
    const where = { organizationId: orgId, ...(status ? { status: status as never } : {}) };
    const [items, total] = await Promise.all([
      prisma.referralCommission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: { select: { fullName: true } },
          ashaProfile: { select: { ashaName: true, ashaId: true } },
          referralPartner: { select: { referralPartnerName: true, referralId: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.referralCommission.count({ where }),
    ]);
    sendPaginated(res, items, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/commissions/:id', validateBody(z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PAYABLE', 'PAID', 'ON_HOLD']).optional(),
  holdReason: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const commission = await prisma.referralCommission.findFirst({ where: { id, organizationId: orgId } });
    if (!commission) throw new AppError('Commission not found', 404);

    const updated = await prisma.referralCommission.update({
      where: { id },
      data: {
        ...req.body,
        ...(req.body.status === 'APPROVED' ? { approvedAt: new Date() } : {}),
        ...(req.body.status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    if (req.body.status === 'PAID') {
      const wallet = await prisma.referralWallet.findFirst({
        where: {
          ...(commission.ashaProfileId ? { ashaProfileId: commission.ashaProfileId } : { referralPartnerId: commission.referralPartnerId! }),
        },
      });
      if (wallet) {
        await prisma.referralWallet.update({
          where: { id: wallet.id },
          data: {
            pending: { decrement: commission.commissionAmount },
            paid: { increment: commission.commissionAmount },
          },
        });
      }
    }

    sendSuccess(res, updated, 'Commission updated');
  } catch (err) { next(err); }
});

// ─── Analytics ───────────────────────────────────────────────────────────────

router.get('/analytics', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const events = await prisma.referralTrackingEvent.groupBy({
      by: ['eventType'],
      where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
      _count: true,
    });

    const eventMap = Object.fromEntries(events.map((e) => [e.eventType, e._count]));

    sendSuccess(res, {
      traffic: {
        linkClicks: (eventMap.LINK_CLICK || 0) + (eventMap.LANDING_VISIT || 0),
        qrScans: eventMap.QR_SCAN || 0,
      },
      registration: {
        formsStarted: eventMap.FORM_STARTED || 0,
        formsSubmitted: eventMap.FORM_SUBMITTED || 0,
        completed: eventMap.PATIENT_REGISTERED || 0,
      },
      patients: {
        registered: eventMap.PATIENT_REGISTERED || 0,
        appointments: eventMap.APPOINTMENT_BOOKED || 0,
        visited: eventMap.PATIENT_VISITED || 0,
        treatmentCompleted: eventMap.TREATMENT_COMPLETED || 0,
      },
      conversion: {
        clickToRegistration: eventMap.LINK_CLICK ? ((eventMap.PATIENT_REGISTERED || 0) / eventMap.LINK_CLICK * 100).toFixed(1) : 0,
        registrationToAppointment: eventMap.PATIENT_REGISTERED ? ((eventMap.APPOINTMENT_BOOKED || 0) / eventMap.PATIENT_REGISTERED * 100).toFixed(1) : 0,
      },
    });
  } catch (err) { next(err); }
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

router.get('/leaderboard', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const connections = await prisma.referralHospitalConnection.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      include: {
        ashaProfile: { select: { ashaId: true, ashaName: true } },
        referralPartner: { select: { referralId: true, referralPartnerName: true } },
      },
      orderBy: { totalPatients: 'desc' },
      take: 20,
    });
    sendSuccess(res, connections);
  } catch (err) { next(err); }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    let settings = await prisma.organizationReferralSettings.findUnique({ where: { organizationId: orgId } });
    if (!settings) {
      settings = await prisma.organizationReferralSettings.create({ data: { organizationId: orgId } });
    }
    sendSuccess(res, settings);
  } catch (err) { next(err); }
});

router.patch('/settings', validateBody(z.object({
  referralEnabled: z.boolean().optional(),
  acceptAsha: z.boolean().optional(),
  acceptReferralPartners: z.boolean().optional(),
  commissionHoldDays: z.number().optional(),
  minPayout: z.number().optional(),
  requireApproval: z.boolean().optional(),
  attributionPolicy: z.enum(['FIRST_CLICK', 'LAST_CLICK', 'REGISTRATION_TIME']).optional(),
}).partial()), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const settings = await prisma.organizationReferralSettings.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...req.body },
      update: req.body,
    });
    sendSuccess(res, settings, 'Referral settings updated');
  } catch (err) { next(err); }
});

// ─── Commission Plans ────────────────────────────────────────────────────────

router.get('/commission-plans', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const plans = await prisma.referralCommissionPlan.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }] },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, plans);
  } catch (err) { next(err); }
});

router.post('/commission-plans', validateBody(z.object({
  name: z.string().min(2),
  ruleType: z.enum(['FIXED', 'TREATMENT_BASED', 'PERCENTAGE', 'SERVICE_BASED']),
  rules: z.record(z.number()),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const plan = await prisma.referralCommissionPlan.create({
      data: { organizationId: orgId, ...req.body },
    });
    sendSuccess(res, plan, 'Commission plan created', 201);
  } catch (err) { next(err); }
});

export default router;
