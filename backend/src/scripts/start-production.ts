// Production entry point: applies pending migrations, then starts the server.
// With several instances, run `node dist/scripts/migrate.js` once as a release step instead
// and set MIGRATE_ON_START=false, so instances do not race to migrate.
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { logger } from '../utils/logger.js';

if (env.MIGRATE_ON_START) {
  try {
    await runMigrations(db);
    logger.info('Database migrations applied');
  } catch (err) {
    logger.fatal({ err }, 'Database migration failed; not starting');
    process.exit(1);
  }
}

await import('../server.js');
