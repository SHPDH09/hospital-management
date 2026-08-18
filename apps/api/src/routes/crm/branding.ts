import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, AppError } from '../../lib/response';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { requireOrgId, assertOrgAdmin } from '../../lib/crm-tenant';
import { logCrmAudit } from '../../lib/crm-audit';
import {
  ORG_BRANDING_SELECT,
  formatHospitalBranding,
  getBrandingRequirements,
  validateImageUrl,
  recordLogoHistory,
} from '../../lib/hospital-branding';

const router = Router();

router.use(authenticate, requireRoles(...CRM_ROLES));

const brandingUpdateSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  logoLightUrl: z.string().url().optional().nullable(),
  logoDarkUrl: z.string().url().optional().nullable(),
  faviconUrl: z.string().url().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  brandColor: z.string().optional().nullable(),
  galleryUrls: z.array(z.string().url()).optional(),
  confirmLogoChange: z.boolean().optional(),
}).partial();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        ...ORG_BRANDING_SELECT,
        galleryUrls: true,
        branches: { select: { id: true, name: true, logoUrl: true, isActive: true } },
      },
    });
    if (!org) throw new AppError('Organization not found', 404);

    const history = await prisma.organizationLogoHistory.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { uploadedBy: { select: { email: true } } },
    });

    const requirements = await getBrandingRequirements();
    sendSuccess(res, {
      branding: formatHospitalBranding(org),
      brandingLocked: org.brandingLocked,
      logoApproved: org.logoApproved,
      branches: org.branches,
      galleryUrls: org.galleryUrls,
      history,
      requirements,
    });
  } catch (err) { next(err); }
});

router.patch('/', validateBody(brandingUpdateSchema), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ...ORG_BRANDING_SELECT, galleryUrls: true, brandingLocked: true },
    });
    if (!existing) throw new AppError('Organization not found', 404);
    if (existing.brandingLocked) throw new AppError('Branding is locked by platform admin', 403);

    const { confirmLogoChange, ...updates } = req.body;
    const logoChanging = 'logoUrl' in updates && updates.logoUrl !== existing.logoUrl;

    if (logoChanging && existing.logoUrl && !confirmLogoChange) {
      throw new AppError(
        'Changing the logo will update branding across your hospital profile, listings, appointments, referrals, staff dashboard and communications. Set confirmLogoChange to true.',
        400,
      );
    }

    for (const [key, val] of Object.entries(updates)) {
      if (typeof val === 'string' && key.includes('Url')) {
        await validateImageUrl(val, key);
      }
    }
    if (updates.galleryUrls) {
      for (const url of updates.galleryUrls) await validateImageUrl(url, 'gallery');
    }

    const data: Record<string, unknown> = { ...updates };
    if (logoChanging && updates.logoUrl) {
      data.previousLogoUrl = existing.logoUrl;
      await recordLogoHistory(
        orgId,
        updates.logoUrl,
        existing.logoUrl ? 'REPLACED' : 'UPLOADED',
        req.user!.userId,
        req.user!.email,
      );
    }

    const org = await prisma.organization.update({ where: { id: orgId }, data });
    await logCrmAudit(req, orgId, 'UPDATE', 'Branding', orgId, updates);
    sendSuccess(res, { branding: formatHospitalBranding(org) }, 'Branding updated');
  } catch (err) { next(err); }
});

router.delete('/logo', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { logoUrl: true, brandingLocked: true },
    });
    if (!existing) throw new AppError('Organization not found', 404);
    if (existing.brandingLocked) throw new AppError('Branding is locked by platform admin', 403);
    if (!existing.logoUrl) throw new AppError('No logo to remove', 400);

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { previousLogoUrl: existing.logoUrl, logoUrl: null },
    });
    await recordLogoHistory(orgId, existing.logoUrl, 'REMOVED', req.user!.userId, req.user!.email);
    await logCrmAudit(req, orgId, 'DELETE', 'BrandingLogo', orgId);
    sendSuccess(res, { branding: formatHospitalBranding(org) }, 'Logo removed');
  } catch (err) { next(err); }
});

export default router;
