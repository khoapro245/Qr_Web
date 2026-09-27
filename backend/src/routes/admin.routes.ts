import { Router } from 'express';
import * as customers from '../controllers/customer.controller.js';
import type { RateLimiters } from '../middleware/rate-limit.js';

/** Mounted behind authenticate + requirePasswordChanged + requireRole('ADMIN'). */
export function createAdminRouter(limiters: RateLimiters): Router {
  const router = Router();

  router.get('/dashboard', customers.dashboard);

  router.get('/users', customers.list);
  router.post('/users', customers.create);
  router.get('/users/:id', customers.detail);
  router.put('/users/:id', customers.update);
  router.patch('/users/:id/status', customers.setStatus);
  router.post('/users/:id/reset-password', limiters.sensitive, customers.resetPassword);

  return router;
}
