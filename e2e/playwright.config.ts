import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { backendEnv, E2E, ROOT_DIR } from './support/config.js';

// Both servers import the compiled shared package. Fail with a clear message instead of a
// module-not-found error deep inside a server log.
if (!existsSync(join(ROOT_DIR, 'shared', 'dist', 'index.js'))) {
  throw new Error('shared/dist is missing: run the suite with "npm run test:e2e" (it builds it).');
}

// Locally the installed Microsoft Edge is used (no browser download). CI sets
// PW_CHANNEL="" to use Playwright's bundled Chromium instead.
const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './tests',
  // The tests share one database and build on each other's accounts: run them in order.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  use: {
    baseURL: E2E.webUrl,
    ...(channel ? { channel } : {}),
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /admin\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
    },
    {
      // Most scans happen on phones: the public page also runs on a phone viewport.
      name: 'mobile',
      dependencies: ['setup'],
      testMatch: /public-qr\.spec\.ts/,
      use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) },
    },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/scripts/start-backend.ts',
      cwd: ROOT_DIR,
      url: `${E2E.apiUrl}/api/health`,
      env: backendEnv(),
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      // The production build (with its Content-Security-Policy), served by `vite preview`.
      // `shared` is built once beforehand by `npm run test:e2e`, not here: both servers start
      // together, and rebuilding it here would rewrite files the API is loading.
      command: `npm run build -w frontend && npm run preview -w frontend -- --port ${E2E.webPort} --strictPort`,
      cwd: ROOT_DIR,
      url: E2E.webUrl,
      env: { VITE_API_PROXY_TARGET: E2E.apiUrl },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
