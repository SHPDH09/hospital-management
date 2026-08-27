import { Router } from 'express';
import { handleMetaCallback } from '../lib/meta-affiliate';

const router = Router();

router.get('/facebook/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code || '');
    if (!code) {
      res.redirect('/admin/affiliate-marketing/facebook?error=missing_code');
      return;
    }
    await handleMetaCallback('facebook', code);
    res.redirect('/admin/affiliate-marketing/facebook?connected=1');
  } catch (err) { next(err); }
});

router.get('/instagram/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code || '');
    if (!code) {
      res.redirect('/admin/affiliate-marketing/instagram?error=missing_code');
      return;
    }
    await handleMetaCallback('instagram', code);
    res.redirect('/admin/affiliate-marketing/instagram?connected=1');
  } catch (err) { next(err); }
});

export default router;
