import { Router } from 'express';
import { checkDatabaseConnection } from '../db/client.js';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/authenticate.js';
import type { RateLimiters } from '../middleware/rate-limit.js';
import { createAdminRouter } from './admin.routes.js';
import { createAuthRouter } from './auth.routes.js';

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
  api.use(
    '/admin',
    authenticate,
    requirePasswordChanged,
    requireRole('ADMIN'),
    createAdminRouter(),
  );

  return api;
}
