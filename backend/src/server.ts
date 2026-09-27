import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { purgeStaleAuthRecords } from './services/maintenance.service.js';
import { logger } from './utils/logger.js';

const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const app = createApp();

const server = app.listen(env.PORT, env.HOST, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
  logger.info(`QR Care API listening on http://${env.HOST}:${env.PORT}`);
});

async function runMaintenance() {
  try {
    const removed = await purgeStaleAuthRecords();
    logger.info({ removed }, 'maintenance.purged_stale_auth_records');
  } catch (err) {
    logger.error({ err }, 'maintenance.failed');
  }
}

void runMaintenance();
// unref: the timer alone never keeps the process alive during shutdown.
setInterval(() => void runMaintenance(), MAINTENANCE_INTERVAL_MS).unref();

/**
 * Stops accepting connections, lets in-flight requests finish, then closes the database pool.
 * Platforms send SIGTERM before replacing a container during a deploy.
 */
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
  // Force exit if open connections keep the server alive.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
