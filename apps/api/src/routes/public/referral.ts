import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { sendSuccess, AppError } from '../../lib/response';
import { trackReferralEvent } from '../../lib/referral-service';
import { ORG_BRANDING_SELECT, attachBrandingToOrganization } from '../../lib/hospital-branding';

const router = Router();

// ─── Resolve referral by code (landing page data) ────────────────────────────

router.get('/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const campaign = await prisma.referralCampaign.findFirst({
      where: { referralCode: { equals: code, mode: 'insensitive' }, isActive: true },
      include: {
        organization: { select: { ...ORG_BRANDING_SELECT, city: true, description: true } },
        ashaProfile: { select: { ashaId: true, ashaName: true, ashaPhoto: true, status: true } },
        referralPartner: { select: { referralId: true, referralPartnerName: true, referralPhoto: true, status: true } },
      },
    });

    if (!campaign) throw new AppError('Referral link not found or inactive', 404);

    const referralName = campaign.ashaProfile?.ashaName || campaign.referralPartner?.referralPartnerName;
    const referralType = campaign.ashaProfile ? 'ASHA' : 'REFERRAL_PARTNER';
    const isActive = campaign.ashaProfile?.status === 'ACTIVE' || campaign.referralPartner?.status === 'ACTIVE';

    if (!isActive) throw new AppError('Referral profile is not active', 403);

    await trackReferralEvent({
      eventType: 'LANDING_VISIT',
      ashaProfileId: campaign.ashaProfileId || undefined,
      referralPartnerId: campaign.referralPartnerId || undefined,
      organizationId: campaign.organizationId || undefined,
      campaignId: campaign.id,
      metadata: { userAgent: req.headers['user-agent'], ip: req.ip },
    });

    sendSuccess(res, {
      referralName,
      referralType,
      referralId: campaign.ashaProfile?.ashaId || campaign.referralPartner?.referralId,
      referralCode: campaign.referralCode,
      campaignId: campaign.id,
      ashaProfileId: campaign.ashaProfileId,
      referralPartnerId: campaign.referralPartnerId,
      organizationId: campaign.organizationId,
      organization: campaign.organization
        ? attachBrandingToOrganization(campaign.organization)
        : null,
      qrCodeUrl: campaign.qrCodeUrl,
    });
  } catch (err) { next(err); }
});

// ─── Track click / QR scan ───────────────────────────────────────────────────

router.post('/:code/track', async (req, res, next) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const { eventType } = req.body as { eventType?: string };
    const campaign = await prisma.referralCampaign.findFirst({
      where: { referralCode: { equals: code, mode: 'insensitive' } },
    });
    if (!campaign) throw new AppError('Invalid referral code', 404);

    const type = eventType === 'QR_SCAN' ? 'QR_SCAN' as const : 'LINK_CLICK' as const;
    await trackReferralEvent({
      eventType: type,
      ashaProfileId: campaign.ashaProfileId || undefined,
      referralPartnerId: campaign.referralPartnerId || undefined,
      organizationId: campaign.organizationId || undefined,
      campaignId: campaign.id,
      metadata: req.body.metadata,
    });

    sendSuccess(res, { tracked: true });
  } catch (err) { next(err); }
});

// ─── Form events ─────────────────────────────────────────────────────────────

router.post('/:code/form-started', async (req, res, next) => {
  try {
    const campaign = await prisma.referralCampaign.findFirst({
      where: { referralCode: { equals: String(req.params.code), mode: 'insensitive' } },
    });
    if (!campaign) throw new AppError('Invalid code', 404);
    await trackReferralEvent({
      eventType: 'FORM_STARTED',
      ashaProfileId: campaign.ashaProfileId || undefined,
      referralPartnerId: campaign.referralPartnerId || undefined,
      organizationId: campaign.organizationId || undefined,
      campaignId: campaign.id,
    });
    sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
});

router.post('/:code/form-submitted', async (req, res, next) => {
  try {
    const campaign = await prisma.referralCampaign.findFirst({
      where: { referralCode: { equals: String(req.params.code), mode: 'insensitive' } },
    });
    if (!campaign) throw new AppError('Invalid code', 404);
    await trackReferralEvent({
      eventType: 'FORM_SUBMITTED',
      ashaProfileId: campaign.ashaProfileId || undefined,
      referralPartnerId: campaign.referralPartnerId || undefined,
      organizationId: campaign.organizationId || undefined,
      campaignId: campaign.id,
    });
    sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
});

export default router;
