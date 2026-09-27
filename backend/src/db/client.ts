import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import * as schema from './schema.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
});

// An idle client can error (e.g. the database restarts). Without a listener this would crash
// the process; the pool discards the broken client on its own.
pool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL idle client error');
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
/** A database handle or an open transaction; repositories accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
