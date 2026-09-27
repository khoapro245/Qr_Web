import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

// Local runs reuse backend/.env for the database credentials; CI sets E2E_DATABASE_URL.
const backendEnvFile = join(ROOT_DIR, 'backend', '.env');
if (!process.env.E2E_DATABASE_URL && existsSync(backendEnvFile)) {
  process.loadEnvFile(backendEnvFile);
}

function e2eDatabaseUrl(): string {
  const url =
    process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL?.replace(/_test(\?|$)/, '_e2e$1');
  // The E2E run wipes this database, so insist on a dedicated *_e2e database.
  if (!url || !/\/[a-z0-9_]+_e2e(\?|$)/.test(url)) {
    throw new Error('Set E2E_DATABASE_URL (or TEST_DATABASE_URL) to a database ending in "_e2e".');
  }
  return url;
}

const API_PORT = 4100;
const WEB_PORT = 4174;
const WORK_DIR = join(tmpdir(), 'qrcare-e2e');

export const E2E = {
  apiUrl: `http://127.0.0.1:${API_PORT}`,
  webUrl: `http://localhost:${WEB_PORT}`,
  webPort: WEB_PORT,
  databaseUrl: e2eDatabaseUrl(),
  storageDir: join(WORK_DIR, 'storage'),
  outboxFile: join(WORK_DIR, 'outbox.jsonl'),
  adminStorageState: join(ROOT_DIR, 'e2e', '.auth', 'admin.json'),
  admin: {
    email: 'admin@e2e.qrcare.test',
    initialPassword: 'E2eInitial-Pass-2026',
    password: 'E2eAdmin-Pass-2026',
  },
};

/** Environment for the API server under test (never used outside end-to-end runs). */
export function backendEnv(): Record<string, string> {
  return {
    // "test" disables rate limiting (the suite logs in many times from one address) and
    // keeps the server log quiet. Everything else mirrors a production-like setup.
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(API_PORT),
    APP_ORIGIN: E2E.webUrl,
    PUBLIC_QR_BASE_URL: E2E.webUrl,
    DATABASE_URL: E2E.databaseUrl,
    JWT_ACCESS_SECRET: 'e2e-only-jwt-secret-not-used-anywhere-else-000000',
    OTP_SECRET: 'e2e-only-otp-secret-not-used-anywhere-else-000000',
    STORAGE_PROVIDER: 'local',
    STORAGE_LOCAL_DIR: E2E.storageDir,
    EMAIL_PROVIDER: 'console',
    SMS_PROVIDER: 'console',
    DEV_OUTBOX_FILE: E2E.outboxFile,
  };
}
