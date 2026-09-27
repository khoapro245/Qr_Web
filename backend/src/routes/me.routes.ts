import { Router } from 'express';
import * as avatars from '../controllers/avatar.controller.js';
import * as customers from '../controllers/customer.controller.js';

/**
 * The signed-in customer's own data. There are deliberately no :id parameters here: a
 * customer can only ever address their own record. The avatar is read-only for customers.
 * Mounted behind authenticate + requirePasswordChanged + requireRole('CUSTOMER').
 */
export function createMeRouter(): Router {
  const router = Router();
  router.get('/profile', customers.ownProfile);
  router.put('/profile', customers.updateOwnProfile);
  router.get('/avatar', avatars.showOwn);
  return router;
}
