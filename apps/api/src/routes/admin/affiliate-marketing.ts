import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { AuthRequest } from '../../middleware/auth';
import { logAudit } from '../../lib/audit';
import {
  connectWhatsAppCloud,
  deleteContactList,
  disconnectWhatsApp,
  getContactLists,
  getWhatsAppSetupInfo,
  getWhatsAppStatus,
  parsePhoneList,
  saveContactList,
  sendBulkWhatsAppMessages,
} from '../../lib/whatsapp-affiliate';
import {
  disconnectSocial,
  getAffiliateSettings,
  getMetaAuthUrl,
  getSocialConnection,
  saveAffiliateSettings,
} from '../../lib/meta-affiliate';

const router = Router();

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [whatsapp, facebook, instagram, campaigns, setup] = await Promise.all([
      getWhatsAppStatus(),
      getSocialConnection('facebook'),
      getSocialConnection('instagram'),
      prisma.affiliateBulkCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      getWhatsAppSetupInfo(),
    ]);

    sendSuccess(res, {
      whatsapp,
      facebook,
      instagram,
      recentCampaigns: campaigns,
      setup,
      connectedChannels: [
        whatsapp.status === 'connected' ? 'whatsapp' : null,
        facebook.status === 'connected' ? 'facebook' : null,
        instagram.status === 'connected' ? 'instagram' : null,
      ].filter(Boolean),
    });
  } catch (err) { next(err); }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await getAffiliateSettings();
    sendSuccess(res, {
      metaAppId: settings.metaAppId || '',
      metaAppSecret: settings.metaAppSecret ? '********' : '',
      hasMetaSecret: Boolean(settings.metaAppSecret),
      whatsappPhoneNumberId: settings.whatsappPhoneNumberId || '',
      hasWhatsAppToken: Boolean(settings.whatsappAccessToken),
      ...(await getWhatsAppSetupInfo()),
    });
  } catch (err) { next(err); }
});

router.put('/settings', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      metaAppId: z.string().optional(),
      metaAppSecret: z.string().optional(),
    }).parse(req.body);

    const current = await getAffiliateSettings();
    const nextSettings = {
      ...current,
      ...(body.metaAppId !== undefined ? { metaAppId: body.metaAppId } : {}),
      ...(body.metaAppSecret && body.metaAppSecret !== '********'
        ? { metaAppSecret: body.metaAppSecret }
        : {}),
    };
    await saveAffiliateSettings(nextSettings);
    await logAudit(req, 'Affiliate Settings Updated', 'affiliate_settings', undefined, nextSettings);
    sendSuccess(res, { saved: true });
  } catch (err) { next(err); }
});

// ─── WhatsApp Cloud API ──────────────────────────────────────────────────────

router.get('/whatsapp/status', async (_req, res, next) => {
  try {
    sendSuccess(res, await getWhatsAppStatus());
  } catch (err) { next(err); }
});

router.get('/whatsapp/setup', async (_req, res, next) => {
  try {
    sendSuccess(res, await getWhatsAppSetupInfo());
  } catch (err) { next(err); }
});

router.post('/whatsapp/connect', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      accessToken: z.string().min(1),
      phoneNumberId: z.string().min(1),
      businessAccountId: z.string().optional(),
    }).parse(req.body);

    const status = await connectWhatsAppCloud(body);
    await logAudit(req, 'WhatsApp Cloud API Connected', 'affiliate_whatsapp');
    sendSuccess(res, status, 'WhatsApp connected');
  } catch (err) { next(err); }
});

router.post('/whatsapp/disconnect', async (req: AuthRequest, res, next) => {
  try {
    await disconnectWhatsApp();
    await logAudit(req, 'WhatsApp Affiliate Disconnected', 'affiliate_whatsapp');
    sendSuccess(res, { disconnected: true });
  } catch (err) { next(err); }
});

router.get('/whatsapp/contact-lists', async (_req, res, next) => {
  try {
    sendSuccess(res, await getContactLists());
  } catch (err) { next(err); }
});

router.post('/whatsapp/contact-lists', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      phones: z.union([z.array(z.string()), z.string()]),
    }).parse(req.body);

    const phoneList = Array.isArray(body.phones) ? body.phones : parsePhoneList(body.phones);
    const lists = await saveContactList(body.name, phoneList);
    await logAudit(req, 'WhatsApp Contact List Created', 'affiliate_whatsapp', body.name);
    sendSuccess(res, lists, 'Contact list saved');
  } catch (err) { next(err); }
});

router.delete('/whatsapp/contact-lists/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const lists = await deleteContactList(id);
    await logAudit(req, 'WhatsApp Contact List Deleted', 'affiliate_whatsapp', id);
    sendSuccess(res, lists);
  } catch (err) { next(err); }
});

router.post('/whatsapp/bulk-send', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      title: z.string().optional(),
      message: z.string().min(1),
      phones: z.union([z.array(z.string()), z.string()]),
      delayMs: z.number().min(500).max(10000).optional(),
    }).parse(req.body);

    const phoneList = Array.isArray(body.phones) ? body.phones : parsePhoneList(body.phones);
    const results = await sendBulkWhatsAppMessages(phoneList, body.message, body.delayMs ?? 2000);
    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.length - sentCount;

    const campaign = await prisma.affiliateBulkCampaign.create({
      data: {
        title: body.title || `Bulk WhatsApp ${new Date().toLocaleString('en-IN')}`,
        channel: 'whatsapp',
        message: body.message,
        recipients: phoneList,
        status: failedCount === 0 ? 'completed' : sentCount > 0 ? 'partial' : 'failed',
        sentCount,
        failedCount,
        results: results as unknown as Prisma.InputJsonValue,
        createdByEmail: req.user?.email,
      },
    });

    await logAudit(req, 'WhatsApp Bulk Send', 'affiliate_whatsapp', campaign.id, { sentCount, failedCount });
    sendSuccess(res, { campaign, results, sentCount, failedCount });
  } catch (err) { next(err); }
});

router.get('/whatsapp/campaigns', async (_req, res, next) => {
  try {
    const campaigns = await prisma.affiliateBulkCampaign.findMany({
      where: { channel: 'whatsapp' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    sendSuccess(res, campaigns);
  } catch (err) { next(err); }
});

// ─── Facebook / Instagram (Meta OAuth) ───────────────────────────────────────

router.get('/facebook/status', async (_req, res, next) => {
  try { sendSuccess(res, await getSocialConnection('facebook')); } catch (err) { next(err); }
});

router.get('/instagram/status', async (_req, res, next) => {
  try { sendSuccess(res, await getSocialConnection('instagram')); } catch (err) { next(err); }
});

router.get('/facebook/auth-url', async (req: AuthRequest, res, next) => {
  try {
    const state = Buffer.from(JSON.stringify({ platform: 'facebook', userId: req.user?.userId })).toString('base64url');
    sendSuccess(res, { url: await getMetaAuthUrl('facebook', state) });
  } catch (err) { next(err); }
});

router.get('/instagram/auth-url', async (req: AuthRequest, res, next) => {
  try {
    const state = Buffer.from(JSON.stringify({ platform: 'instagram', userId: req.user?.userId })).toString('base64url');
    sendSuccess(res, { url: await getMetaAuthUrl('instagram', state) });
  } catch (err) { next(err); }
});

router.post('/facebook/disconnect', async (req: AuthRequest, res, next) => {
  try {
    await disconnectSocial('facebook');
    await logAudit(req, 'Facebook Affiliate Disconnected', 'affiliate_facebook');
    sendSuccess(res, { disconnected: true });
  } catch (err) { next(err); }
});

router.post('/instagram/disconnect', async (req: AuthRequest, res, next) => {
  try {
    await disconnectSocial('instagram');
    await logAudit(req, 'Instagram Affiliate Disconnected', 'affiliate_instagram');
    sendSuccess(res, { disconnected: true });
  } catch (err) { next(err); }
});

export default router;
