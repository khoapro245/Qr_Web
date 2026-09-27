// Applies pending database migrations: `npm run db:migrate` (dev) or
// `node dist/scripts/migrate.js` (production).
import { db, pool } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { logger } from '../utils/logger.js';

try {
  await runMigrations(db);
  logger.info('Database migrations applied');
} catch (err) {
  logger.error({ err }, 'Database migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
