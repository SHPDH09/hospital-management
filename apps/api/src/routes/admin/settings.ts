import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { logAudit } from '../../lib/audit';
import {
  SETTING_CATEGORIES,
  SettingCategory,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
  settingsKey,
  mergeWithDefaults,
  maskSecrets,
  applySecretUpdates,
  diffSettings,
} from '../../lib/settings';
import { invalidateCashfreeConfigCache, testCashfreeConnection, getCashfreeConfig } from '../../lib/cashfree';
import { cashfreeWhitelistMeta, getAppUrl } from '../../lib/app-url';

const router = Router();

function isValidCategory(cat: string): cat is SettingCategory {
  return (SETTING_CATEGORIES as readonly string[]).includes(cat);
}

async function getCategorySettings(category: SettingCategory): Promise<Record<string, unknown>> {
  const key = settingsKey(category);
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  const raw = row?.value as Record<string, unknown> | null;
  return mergeWithDefaults(category, raw);
}

async function saveCategorySettings(
  req: AuthRequest,
  category: SettingCategory,
  incoming: Record<string, unknown>
) {
  const key = settingsKey(category);
  const existing = await getCategorySettings(category);
  const updated = applySecretUpdates(category, existing, incoming);
  const changes = diffSettings(existing, updated);

  const row = await prisma.platformSetting.upsert({
    where: { key },
    update: { value: updated as Prisma.InputJsonValue, category: 'settings' },
    create: { key, value: updated as Prisma.InputJsonValue, category: 'settings' },
  });

  if (Object.keys(changes).length > 0) {
    await logAudit(req, 'SETTINGS_UPDATE', 'PlatformSetting', category, {
      category,
      changes: maskSecrets(category, changes as Record<string, unknown>),
      changedBy: req.user?.email,
      changedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue);
  }

  if (category === 'payment') invalidateCashfreeConfigCache();

  return { row, settings: maskSecrets(category, updated) };
}

// ─── Overview ────────────────────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { startsWith: 'settings.' } },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key.replace('settings.', ''), r]));

    const categories = SETTING_CATEGORIES.map((cat) => ({
      id: cat,
      label: CATEGORY_LABELS[cat],
      updatedAt: byKey[cat]?.updatedAt ?? null,
      configured: !!byKey[cat],
    }));

    sendSuccess(res, { categories, total: SETTING_CATEGORIES.length });
  } catch (err) {
    next(err);
  }
});

router.get('/all', async (_req, res, next) => {
  try {
    const result: Record<string, unknown> = {};
    for (const cat of SETTING_CATEGORIES) {
      const settings = await getCategorySettings(cat);
      result[cat] = maskSecrets(cat, settings);
    }
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ─── Audit logs for settings ─────────────────────────────────────────────────

router.get('/logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const category = req.query.category as string | undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'PlatformSetting',
        ...(category && { entityId: category }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, role: true } } },
    });

    sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
});

// ─── Test email ──────────────────────────────────────────────────────────────

router.post('/email/test', async (req: AuthRequest, res, next) => {
  try {
    const { to } = z.object({ to: z.string().email() }).parse(req.body);
    const emailSettings = await getCategorySettings('email');

    await logAudit(req, 'TEST_EMAIL', 'PlatformSetting', 'email', { to } as Prisma.InputJsonValue);

    sendSuccess(
      res,
      {
        sent: true,
        to,
        provider: emailSettings.provider,
        message: `Test email queued to ${to} via ${emailSettings.provider || 'SMTP'} (simulated delivery)`,
      },
      'Test email sent successfully'
    );
  } catch (err) {
    next(err);
  }
});

// ─── Cashfree domain whitelist info ──────────────────────────────────────────

router.get('/payment/cashfree-whitelist', async (_req, res, next) => {
  try {
    const cf = await getCashfreeConfig();
    const mode = cf.env === 'production' ? 'production' : 'sandbox';
    sendSuccess(res, {
      appUrl: getAppUrl(),
      ...cashfreeWhitelistMeta(mode, cf.domainWhitelisted),
      policyPages: ['/terms', '/privacy', '/refund', '/contact'],
    });
  } catch (err) {
    next(err);
  }
});

// ─── Test Cashfree ───────────────────────────────────────────────────────────

router.post('/payment/test-cashfree', async (req: AuthRequest, res, next) => {
  try {
    invalidateCashfreeConfigCache();
    const result = await testCashfreeConnection();
    await logAudit(req, 'TEST_CASHFREE', 'PlatformSetting', 'payment', {
      ok: result.ok,
      env: result.env,
    } as Prisma.InputJsonValue);
    sendSuccess(res, result, result.ok ? 'Cashfree connection OK' : 'Cashfree connection failed');
  } catch (err) {
    next(err);
  }
});

// ─── Seed / reset defaults ───────────────────────────────────────────────────

router.post('/seed-defaults', async (req: AuthRequest, res, next) => {
  try {
    for (const cat of SETTING_CATEGORIES) {
      const key = settingsKey(cat);
      const existing = await prisma.platformSetting.findUnique({ where: { key } });
      if (!existing) {
        await prisma.platformSetting.create({
          data: {
            key,
            category: 'settings',
            value: DEFAULT_SETTINGS[cat] as Prisma.InputJsonValue,
          },
        });
      }
    }
    await logAudit(req, 'SETTINGS_SEED', 'PlatformSetting', 'all');
    sendSuccess(res, null, 'Default settings seeded for missing categories');
  } catch (err) {
    next(err);
  }
});

// ─── Category CRUD ───────────────────────────────────────────────────────────

router.get('/:category', async (req, res, next) => {
  try {
    const category = paramId(req.params.category);
    if (!isValidCategory(category)) {
      res.status(404).json({ success: false, message: 'Unknown settings category' });
      return;
    }
    const settings = await getCategorySettings(category);
    sendSuccess(res, maskSecrets(category, settings));
  } catch (err) {
    next(err);
  }
});

router.put('/:category', async (req: AuthRequest, res, next) => {
  try {
    const category = paramId(req.params.category);
    if (!isValidCategory(category)) {
      res.status(404).json({ success: false, message: 'Unknown settings category' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const { settings } = await saveCategorySettings(req, category, body);
    sendSuccess(res, settings, `${CATEGORY_LABELS[category]} updated`);
  } catch (err) {
    next(err);
  }
});

export default router;
