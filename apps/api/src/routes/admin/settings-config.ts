import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

const PLATFORM_KEYS = [
  'platformName', 'shortName', 'logoUrl', 'faviconUrl', 'tagline', 'description',
  'supportEmail', 'supportPhone', 'businessEmail', 'businessAddress',
] as const;

const BRANDING_KEYS = [
  'primaryColor', 'secondaryColor', 'coverImageUrl', 'loginBannerUrl', 'footerText',
] as const;

async function getSettingsGroup(keys: readonly string[]) {
  const settings = await prisma.platformSetting.findMany({
    where: { key: { in: [...keys] } },
  });
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const setting = settings.find((s) => s.key === key);
    result[key] = setting?.value ?? '';
  }
  return result;
}

async function upsertSettingsGroup(
  data: Record<string, unknown>,
  category: string,
  keys: readonly string[],
) {
  for (const key of keys) {
    if (data[key] === undefined) continue;
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value: data[key] as Prisma.InputJsonValue, category },
      create: { key, value: data[key] as Prisma.InputJsonValue, category },
    });
  }
}

router.get('/platform', async (_req, res, next) => {
  try {
    sendSuccess(res, await getSettingsGroup(PLATFORM_KEYS));
  } catch (err) { next(err); }
});

router.put('/platform', validateBody(z.object({
  platformName: z.string().optional(),
  shortName: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  supportEmail: z.string().optional(),
  supportPhone: z.string().optional(),
  businessEmail: z.string().optional(),
  businessAddress: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    await upsertSettingsGroup(req.body, 'platform', PLATFORM_KEYS);
    await logAudit(req, 'UPDATE', 'PlatformSettings', 'platform', req.body as Prisma.InputJsonValue);
    sendSuccess(res, await getSettingsGroup(PLATFORM_KEYS), 'Platform settings saved');
  } catch (err) { next(err); }
});

router.get('/branding', async (_req, res, next) => {
  try {
    sendSuccess(res, await getSettingsGroup(BRANDING_KEYS));
  } catch (err) { next(err); }
});

router.put('/branding', validateBody(z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  coverImageUrl: z.string().optional(),
  loginBannerUrl: z.string().optional(),
  footerText: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    await upsertSettingsGroup(req.body, 'branding', BRANDING_KEYS);
    await logAudit(req, 'UPDATE', 'BrandingSettings', 'branding', req.body as Prisma.InputJsonValue);
    sendSuccess(res, await getSettingsGroup(BRANDING_KEYS), 'Branding settings saved');
  } catch (err) { next(err); }
});

export default router;
