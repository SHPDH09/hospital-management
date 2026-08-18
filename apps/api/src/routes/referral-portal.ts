import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { buildReferralLink, buildQrCodeUrl } from '../lib/referral';
import { ORG_BRANDING_SELECT, attachBrandingToOrganization } from '../lib/hospital-branding';

const router = Router();

const REFERRAL_ROLES = ['ASHA', 'REFERRAL_PARTNER'] as const;

async function resolveReferralProfile(userId: string) {
  const asha = await prisma.ashaProfile.findUnique({ where: { userId } });
  if (asha) return { type: 'ASHA' as const, asha, partner: null };
  const partner = await prisma.referralPartner.findUnique({ where: { userId } });
  if (partner) return { type: 'REFERRAL_PARTNER' as const, asha: null, partner };
  return null;
}

router.use(authenticate, requireRoles(...REFERRAL_ROLES));

// ─── Overview Dashboard ──────────────────────────────────────────────────────

router.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Referral profile not found', 404);

    const filter = profile.asha
      ? { ashaProfileId: profile.asha.id }
      : { referralPartnerId: profile.partner!.id };

    const wallet = await prisma.referralWallet.findFirst({ where: filter });
    const events = await prisma.referralTrackingEvent.groupBy({
      by: ['eventType'],
      where: filter,
      _count: true,
    });
    const eventMap = Object.fromEntries(events.map((e) => [e.eventType, e._count]));

    const connections = await prisma.referralHospitalConnection.findMany({
      where: { ...filter, status: 'ACTIVE' },
      include: { organization: { select: ORG_BRANDING_SELECT } },
    });

    sendSuccess(res, {
      profile: profile.asha || profile.partner,
      type: profile.type,
      displayName: profile.asha?.ashaName || profile.partner?.referralPartnerName,
      displayId: profile.asha?.ashaId || profile.partner?.referralId,
      stats: {
        totalReferrals: eventMap.PATIENT_REGISTERED || 0,
        linkClicks: (eventMap.LINK_CLICK || 0) + (eventMap.LANDING_VISIT || 0),
        formsSubmitted: eventMap.FORM_SUBMITTED || 0,
        patientsRegistered: eventMap.PATIENT_REGISTERED || 0,
        appointments: eventMap.APPOINTMENT_BOOKED || 0,
        patientsVisited: eventMap.PATIENT_VISITED || 0,
        treatmentCompleted: eventMap.TREATMENT_COMPLETED || 0,
      },
      wallet: wallet || { totalEarned: 0, pending: 0, approved: 0, paid: 0, onHold: 0 },
      hospitals: connections.map((c) => ({
        ...c,
        organization: c.organization ? attachBrandingToOrganization(c.organization) : c.organization,
      })),
    });
  } catch (err) { next(err); }
});

// ─── Profile ─────────────────────────────────────────────────────────────────

router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const campaigns = await prisma.referralCampaign.findMany({
      where: profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, {
      type: profile.type,
      profile: profile.asha || profile.partner,
      campaigns,
    });
  } catch (err) { next(err); }
});

// ─── My Hospitals ────────────────────────────────────────────────────────────

router.get('/hospitals', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const filter = profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id };
    const connections = await prisma.referralHospitalConnection.findMany({
      where: filter,
      include: { organization: { select: { ...ORG_BRANDING_SELECT, city: true } }, commissionPlan: true },
      orderBy: { connectionDate: 'desc' },
    });
    sendSuccess(res, connections.map((c) => ({
      ...c,
      organization: attachBrandingToOrganization(c.organization),
    })));
  } catch (err) { next(err); }
});

// ─── Referred Patients (limited fields) ──────────────────────────────────────

router.get('/patients', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const filter = profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id };

    const attributions = await prisma.patientReferralAttribution.findMany({
      where: filter,
      include: {
        organization: { select: ORG_BRANDING_SELECT },
        patient: { select: { id: true, fullName: true } },
        commissions: { select: { commissionAmount: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const patients = attributions.map((a) => ({
      patientId: a.patient.id,
      patientName: a.patient.fullName,
      hospital: a.organization.name,
      organization: attachBrandingToOrganization(a.organization),
      registrationDate: a.registrationTouchAt,
      treatmentStatus: a.treatmentStatus,
      commissionStatus: a.commissionStatus,
      commission: a.commissions[0]?.commissionAmount || 0,
    }));

    sendSuccess(res, patients);
  } catch (err) { next(err); }
});

// ─── Analytics ───────────────────────────────────────────────────────────────

router.get('/analytics', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const filter = profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id };

    const events = await prisma.referralTrackingEvent.groupBy({
      by: ['eventType'],
      where: filter,
      _count: true,
    });
    const m = Object.fromEntries(events.map((e) => [e.eventType, e._count]));

    sendSuccess(res, {
      clicks: (m.LINK_CLICK || 0) + (m.LANDING_VISIT || 0),
      qrScans: m.QR_SCAN || 0,
      formsSubmitted: m.FORM_SUBMITTED || 0,
      registrations: m.PATIENT_REGISTERED || 0,
      appointments: m.APPOINTMENT_BOOKED || 0,
      visited: m.PATIENT_VISITED || 0,
      treatmentCompleted: m.TREATMENT_COMPLETED || 0,
      conversionRate: {
        clickToRegistration: m.LINK_CLICK ? ((m.PATIENT_REGISTERED || 0) / m.LINK_CLICK * 100).toFixed(1) : '0',
        registrationToTreatment: m.PATIENT_REGISTERED ? ((m.TREATMENT_COMPLETED || 0) / m.PATIENT_REGISTERED * 100).toFixed(1) : '0',
      },
    });
  } catch (err) { next(err); }
});

// ─── Commission & Wallet ─────────────────────────────────────────────────────

router.get('/commissions', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const filter = profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id };

    const [commissions, wallet] = await Promise.all([
      prisma.referralCommission.findMany({
        where: filter,
        include: { organization: { select: { name: true } }, patient: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.referralWallet.findFirst({ where: filter }),
    ]);

    sendSuccess(res, { wallet, commissions });
  } catch (err) { next(err); }
});

// ─── Payouts ─────────────────────────────────────────────────────────────────

router.get('/payouts', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const wallet = await prisma.referralWallet.findFirst({
      where: profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id },
      include: { payouts: { orderBy: { requestedAt: 'desc' } } },
    });
    sendSuccess(res, wallet);
  } catch (err) { next(err); }
});

router.post('/payouts/request', validateBody(z.object({
  amount: z.number().min(1),
  bankDetails: z.object({
    accountHolderName: z.string(),
    bankName: z.string(),
    accountNumber: z.string(),
    ifsc: z.string().optional(),
    upiId: z.string().optional(),
  }),
})), async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const wallet = await prisma.referralWallet.findFirst({
      where: profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id },
    });
    if (!wallet) throw new AppError('Wallet not found', 404);
    if (req.body.amount > wallet.approved) throw new AppError('Insufficient approved balance', 400);

    const payout = await prisma.referralPayout.create({
      data: { walletId: wallet.id, amount: req.body.amount, bankDetails: req.body.bankDetails, status: 'PENDING' },
    });
    sendSuccess(res, payout, 'Payout requested', 201);
  } catch (err) { next(err); }
});

// ─── Campaigns / QR ──────────────────────────────────────────────────────────

router.get('/campaigns', async (req: AuthRequest, res, next) => {
  try {
    const profile = await resolveReferralProfile(req.user!.userId);
    if (!profile) throw new AppError('Profile not found', 404);
    const campaigns = await prisma.referralCampaign.findMany({
      where: profile.asha ? { ashaProfileId: profile.asha.id } : { referralPartnerId: profile.partner!.id },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, campaigns);
  } catch (err) { next(err); }
});

export default router;
