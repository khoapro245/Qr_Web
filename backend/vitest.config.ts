import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const fileEnv = loadEnv('test', process.cwd(), '');
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;

// The suite truncates every table, so refuse to run against anything but a *_test database.
if (!testDatabaseUrl || !/\/[^/?]+_test(\?|$)/.test(testDatabaseUrl)) {
  throw new Error('TEST_DATABASE_URL must be set and point to a database ending in "_test".');
}

// Applied here (not only via test.env) so globalSetup, which runs in this process, sees it too.
Object.assign(process.env, {
  ...fileEnv,
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl,
  STORAGE_PROVIDER: 'local',
  STORAGE_LOCAL_DIR: join(tmpdir(), 'qrcare-test-storage'),
});

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entry points and CLI scripts are exercised by running them, not by unit tests.
      exclude: ['src/server.ts', 'src/scripts/**', 'src/types/**'],
      reporter: ['text-summary', 'text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
