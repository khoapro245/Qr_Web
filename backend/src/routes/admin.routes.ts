import { Router } from 'express';
import { getDashboardStats } from '../services/dashboard.service.js';

/** Mounted behind authenticate + requirePasswordChanged + requireRole('ADMIN'). */
export function createAdminRouter(): Router {
  const router = Router();

  router.get('/dashboard', async (_req, res) => {
    res.json({ success: true, data: { stats: await getDashboardStats() } });
  });

  return router;
}
