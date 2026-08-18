import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../lib/response';
import { searchPlatform } from '../../services/search/platform-search';
import { draftCommunicationReply, translateMessage } from '../../services/communications/draft-replies';
import { getFraudDashboard } from '../../services/reviews/fraud-detection';

const router = Router();

router.get('/search', authenticate, requireRoles(...PLATFORM_ROLES), async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return sendSuccess(res, { results: [], interpretedQuery: '' });
    sendSuccess(res, await searchPlatform(q, Number(req.query.limit) || 20));
  } catch (err) { next(err); }
});

router.get('/fraud', authenticate, requireRoles(...PLATFORM_ROLES), async (_req, res, next) => {
  try {
    sendSuccess(res, await getFraudDashboard());
  } catch (err) { next(err); }
});

router.post('/communications/draft', authenticate, requireRoles(...PLATFORM_ROLES), validateBody(z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  tone: z.enum(['professional', 'empathetic', 'concise']).optional(),
  channel: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const result = await draftCommunicationReply({ ...req.body, userId: req.user!.userId });
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.post('/communications/translate', authenticate, requireRoles(...PLATFORM_ROLES), validateBody(z.object({
  text: z.string().min(1),
  targetLanguage: z.string().min(2),
})), async (req: AuthRequest, res, next) => {
  try {
    const result = await translateMessage({ ...req.body, userId: req.user!.userId });
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

export default router;
