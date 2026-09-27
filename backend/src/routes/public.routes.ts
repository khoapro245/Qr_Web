import { Router, type Request, type Response } from 'express';
import { sendImage } from '../controllers/avatar.controller.js';
import type { RateLimiters } from '../middleware/rate-limit.js';
import { getPublicProfile, loadPublicAvatar } from '../services/public-qr.service.js';

function token(req: Request): string {
  return typeof req.params.token === 'string' ? req.params.token : '';
}

/**
 * Public, unauthenticated QR endpoints. Nothing here reads cookies or sessions: a visitor is
 * anonymous even if they happen to be signed in.
 */
export function createPublicQrRouter(limiters: RateLimiters): Router {
  const router = Router();

  router.use(limiters.publicQr);
  router.use((_req, res, next) => {
    // Personal data: keep it out of search engines and archives.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });

  router.get('/:token', async (req: Request, res: Response) => {
    res.json({ success: true, data: { profile: await getPublicProfile(token(req)) } });
  });

  router.get('/:token/avatar', async (req: Request, res: Response) => {
    sendImage(res, await loadPublicAvatar(token(req)));
  });

  return router;
}
