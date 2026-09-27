import { Router } from 'express';
import { checkDatabaseConnection } from '../db/client.js';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  const databaseUp = await checkDatabaseConnection();
  res.status(databaseUp ? 200 : 503).json({
    success: databaseUp,
    data: { status: databaseUp ? 'ok' : 'degraded', database: databaseUp ? 'up' : 'down' },
  });
});
