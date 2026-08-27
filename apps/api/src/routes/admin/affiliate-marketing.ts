import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { AuthRequest } from '../../middleware/auth';
import { logAudit } from '../../lib/audit';
import {
  disconnectWhatsApp,
  exportGroupParticipants,
  createWhatsAppGroup,
  getWhatsAppStatus,
  listWhatsAppGroups,
  parsePhoneList,
  sendBulkWhatsAppMessages,
  startWhatsAppConnection,
} from '../../lib/whatsapp-affiliate';
import {
  disconnectSocial,
  getAffiliateSettings,
  getMetaAuthUrl,
  getSocialConnection,
  handleMetaCallback,
  saveAffiliateSettings,
} from '../../lib/meta-affiliate';

const router = Router();

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [whatsapp, facebook, instagram, campaigns] = await Promise.all([
      Promise.resolve(getWhatsAppStatus()),
      getSocialConnection('facebook'),
      getSocialConnection('instagram'),
      prisma.affiliateBulkCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);

    sendSuccess(res, {
      whatsapp,
      facebook,
      instagram,
      recentCampaigns: campaigns,
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

// ─── WhatsApp ────────────────────────────────────────────────────────────────

router.get('/whatsapp/status', async (_req, res, next) => {
  try {
    sendSuccess(res, getWhatsAppStatus());
  } catch (err) { next(err); }
});

router.post('/whatsapp/connect', async (req: AuthRequest, res, next) => {
  try {
    const status = await startWhatsAppConnection();
    await logAudit(req, 'WhatsApp Affiliate Connect Started', 'affiliate_whatsapp');
    sendSuccess(res, status);
  } catch (err) { next(err); }
});

router.post('/whatsapp/disconnect', async (req: AuthRequest, res, next) => {
  try {
    await disconnectWhatsApp();
    await logAudit(req, 'WhatsApp Affiliate Disconnected', 'affiliate_whatsapp');
    sendSuccess(res, { disconnected: true });
  } catch (err) { next(err); }
});

router.get('/whatsapp/groups', async (_req, res, next) => {
  try {
    sendSuccess(res, await listWhatsAppGroups());
  } catch (err) { next(err); }
});

router.get('/whatsapp/groups/:groupId/export', async (req, res, next) => {
  try {
    const participants = await exportGroupParticipants(req.params.groupId);
    sendSuccess(res, {
      groupId: req.params.groupId,
      count: participants.length,
      participants,
      csv: ['phone,name,isAdmin', ...participants.map((p) => `${p.phone},${p.name || ''},${p.isAdmin ? 'yes' : 'no'}`)].join('\n'),
    });
  } catch (err) { next(err); }
});

router.post('/whatsapp/groups/create', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      phones: z.union([z.array(z.string()), z.string()]),
    }).parse(req.body);

    const phoneList = Array.isArray(body.phones) ? body.phones : parsePhoneList(body.phones);
    const result = await createWhatsAppGroup(body.name, phoneList);
    await logAudit(req, 'WhatsApp Group Created', 'affiliate_whatsapp', result.groupId, result);
    sendSuccess(res, result, 'Group created');
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
