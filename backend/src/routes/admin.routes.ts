import { Router } from 'express';
import * as avatars from '../controllers/avatar.controller.js';
import * as customers from '../controllers/customer.controller.js';
import * as qr from '../controllers/qr.controller.js';
import type { RateLimiters } from '../middleware/rate-limit.js';
import { avatarUpload } from '../middleware/upload.js';

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

  // Avatars can only ever be changed here, by an admin.
  router.get('/users/:id/avatar', avatars.show);
  router.put('/users/:id/avatar', avatarUpload, avatars.upload);
  router.delete('/users/:id/avatar', avatars.remove);

  router.get('/users/:id/qr', qr.show);
  router.post('/users/:id/qr', qr.generate);
  router.post('/users/:id/qr/regenerate', qr.regenerate);
  router.post('/users/:id/qr/revoke', qr.revoke);
  router.get('/users/:id/qr/image', qr.image);

  return router;
}
