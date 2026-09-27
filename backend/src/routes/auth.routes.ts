import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import type { RateLimiters } from '../middleware/rate-limit.js';

export function createAuthRouter(limiters: RateLimiters): Router {
  const router = Router();
  router.get('/csrf', auth.getCsrfToken);
  router.post('/login', limiters.login, auth.login);
  router.post('/refresh', limiters.refresh, auth.refresh);
  router.post('/logout', auth.logout);
  // Reachable while a password change is still pending — that is how it gets done.
  router.get('/me', authenticate, auth.me);
  router.post('/change-password', limiters.sensitive, authenticate, auth.changePassword);
  return router;
}
