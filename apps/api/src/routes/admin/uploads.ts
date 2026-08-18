import { Router } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { saveBase64Image } from '../../lib/uploads';
import { logAudit } from '../../lib/audit';

const router = Router();
router.use(authenticate, requireRoles(...PLATFORM_ROLES));

router.post('/', validateBody(z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().min(1),
  folder: z.enum(['logos', 'favicons', 'images', 'covers', 'photos']).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const folder = req.body.folder || 'images';
    const url = saveBase64Image(req.body.data, req.body.mimeType, folder);
    await logAudit(req, 'UPLOAD', 'File', undefined, { filename: req.body.filename, folder, url });
    sendSuccess(res, { url, filename: req.body.filename }, 'File uploaded', 201);
  } catch (err) { next(err); }
});

export default router;
