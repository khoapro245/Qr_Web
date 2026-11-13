import { Router } from 'express';
import { getPublicMedicalContent } from '../controllers/medical-content.controller.js';
import { checkDatabaseConnection } from '../db/client.js';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/authenticate.js';
import type { RateLimiters } from '../middleware/rate-limit.js';
import { createAdminRouter } from './admin.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createMeRouter } from './me.routes.js';
import { createPublicQrRouter } from './public.routes.js';

export function createApiRouter(limiters: RateLimiters): Router {
  const api = Router();

  api.get('/health', async (_req, res) => {
    const databaseUp = await checkDatabaseConnection();
    res.status(databaseUp ? 200 : 503).json({
      success: databaseUp,
      data: { status: databaseUp ? 'ok' : 'degraded', database: databaseUp ? 'up' : 'down' },
    });
  });

  api.use('/auth', createAuthRouter(limiters));
  api.get('/medical-content', getPublicMedicalContent);
  api.use('/qr', createPublicQrRouter(limiters));
  api.use(
    '/admin',
    authenticate,
    requirePasswordChanged,
    requireRole('ADMIN'),
    createAdminRouter(limiters),
  );
  api.use('/me', authenticate, requirePasswordChanged, requireRole('CUSTOMER'), createMeRouter());

  return api;
}
