// Starts a fresh API server for the end-to-end suite: dedicated database (created if
// missing, migrated, emptied), empty file storage and outbox, and one admin account.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { backendEnv, E2E } from '../support/config.js';

async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!/^[a-z0-9_]+_e2e$/.test(name)) throw new Error(`Refusing to use database "${name}"`);
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    // The name was validated above, so quoting it as an identifier is safe.
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

// Backend modules read process.env when imported, so configure it first.
Object.assign(process.env, backendEnv());

await ensureDatabase(E2E.databaseUrl);
rmSync(E2E.storageDir, { recursive: true, force: true });
mkdirSync(E2E.storageDir, { recursive: true });
writeFileSync(E2E.outboxFile, '');

const { db, pool } = await import('../../backend/src/db/client.js');
const { runMigrations } = await import('../../backend/src/db/migrate.js');
const { hashPassword } = await import('../../backend/src/utils/password.js');

await runMigrations(db);
await pool.query(
  'TRUNCATE audit_logs, otp_verifications, refresh_tokens, qr_codes, customer_profiles, users RESTART IDENTITY CASCADE',
);
await pool.query(
  `INSERT INTO users (role, email, password_hash, must_change_password)
   VALUES ('ADMIN', $1, $2, true)`,
  [E2E.admin.email, await hashPassword(E2E.admin.initialPassword)],
);

await import('../../backend/src/server.js');
