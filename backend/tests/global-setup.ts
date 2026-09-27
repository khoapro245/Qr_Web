import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { MIGRATIONS_FOLDER } from '../src/db/migrate.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

/** Brings the test database schema up to date once before the whole suite. */
export default async function setup() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
