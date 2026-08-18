import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess, sendPaginated } from '../../lib/response';
import { prisma } from '../../lib/prisma';
import { getAiSettings, updateAiSettings } from '../../services/ai';
import { runAdminCopilot, getPlatformSummary } from '../../services/copilot/admin-copilot';
import { scoreLead, getLeadInsights } from '../../services/leads/lead-scoring';
import { analyzeReview } from '../../services/reviews/review-analysis';
import { classifyComplaint } from '../../services/support/ticket-classifier';
import { paramId } from '../../lib/params';
import { isMedicalQuery, medicalSafetyResponse } from '../../services/ai';

const router = Router();
router.use(authenticate);

// Settings (Super Admin)
router.get('/settings', requireRoles(...PLATFORM_ROLES), async (_req, res, next) => {
  try {
    const settings = await getAiSettings();
    sendSuccess(res, { ...settings, hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY), hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
  } catch (err) { next(err); }
});

router.put('/settings', requireRoles('SUPER_ADMIN'), validateBody(z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['openai', 'gemini', 'none']).optional(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  features: z.record(z.boolean()).optional(),
  leadScoringWeights: z.record(z.number()).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const settings = await updateAiSettings(req.body);
    sendSuccess(res, settings, 'AI settings updated');
  } catch (err) { next(err); }
});

// Admin Copilot
router.post('/copilot', requireRoles(...PLATFORM_ROLES), validateBody(z.object({ query: z.string().min(1).max(2000) })), async (req: AuthRequest, res, next) => {
  try {
    if (isMedicalQuery(req.body.query)) {
      return sendSuccess(res, { answer: medicalSafetyResponse(), fromAi: false, data: null });
    }
    const result = await runAdminCopilot(req.body.query, {
      userId: req.user!.userId,
      role: req.user!.role,
      organizationId: req.user!.organizationId,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/summary', requireRoles(...PLATFORM_ROLES), async (_req, res, next) => {
  try {
    const result = await getPlatformSummary();
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// Lead AI
router.post('/leads/:id/score', requireRoles(...PLATFORM_ROLES), async (req: AuthRequest, res, next) => {
  try {
    const result = await scoreLead(paramId(req.params.id), req.user!.userId);
    sendSuccess(res, result, 'Lead scored');
  } catch (err) { next(err); }
});

router.get('/leads/:id/insights', requireRoles(...PLATFORM_ROLES), async (req, res, next) => {
  try {
    const insights = await getLeadInsights(paramId(req.params.id));
    sendSuccess(res, insights);
  } catch (err) { next(err); }
});

// Review AI
router.post('/reviews/:id/analyze', requireRoles(...PLATFORM_ROLES), async (req: AuthRequest, res, next) => {
  try {
    const result = await analyzeReview(paramId(req.params.id), req.user!.userId);
    sendSuccess(res, result, 'Review analyzed');
  } catch (err) { next(err); }
});

// Complaint AI
router.post('/complaints/:id/classify', requireRoles(...PLATFORM_ROLES), async (req: AuthRequest, res, next) => {
  try {
    const result = await classifyComplaint(paramId(req.params.id), req.user!.userId);
    sendSuccess(res, result, 'Ticket classified');
  } catch (err) { next(err); }
});

// Audit logs
router.get('/audit-logs', requireRoles(...PLATFORM_ROLES), async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.aiAuditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.aiAuditLog.count(),
    ]);
    sendPaginated(res, logs, { page, limit, total });
  } catch (err) { next(err); }
});

// General assistant (role-aware, safe)
router.post('/assistant', validateBody(z.object({ query: z.string().min(1).max(2000) })), async (req: AuthRequest, res, next) => {
  try {
    if (isMedicalQuery(req.body.query)) {
      return sendSuccess(res, { answer: medicalSafetyResponse(), fromAi: false });
    }
    if (['SUPER_ADMIN', 'PLATFORM_STAFF'].includes(req.user!.role)) {
      const result = await runAdminCopilot(req.body.query, {
        userId: req.user!.userId,
        role: req.user!.role,
        organizationId: req.user!.organizationId,
      });
      return sendSuccess(res, result);
    }
    sendSuccess(res, {
      answer: 'I can help you navigate the platform. For account-specific details, please use your dashboard. For medical concerns, consult a qualified healthcare professional.',
      fromAi: false,
    });
  } catch (err) { next(err); }
});

export default router;
