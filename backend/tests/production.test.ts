import { eq } from 'drizzle-orm';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { otpVerifications, refreshTokens } from '../src/db/schema.js';
import { purgeStaleAuthRecords } from '../src/services/maintenance.service.js';
import { createCustomer } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const dist = join(tmpdir(), 'qrcare-test-frontend-dist');
const INDEX_HTML =
  '<!doctype html><html><head><title>QR Care</title></head><body><div id="root"></div></body></html>';

describe('serving the built frontend (production)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    rmSync(dist, { recursive: true, force: true });
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), INDEX_HTML);
    writeFileSync(join(dist, 'assets', 'index-abc123.js'), `console.log(${'"x"'.repeat(2000)})`);
    writeFileSync(join(dist, 'theme-init.js'), '(function(){})();');
    app = createApp({ frontendDir: dist });
  });

  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it.each(['/', '/login', '/admin/users/123', '/qr/AbCdEfGhIjKlMnOpQrStUv'])(
    'answers client route %s with index.html and a strict page policy',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/html/);
      expect(res.text).toContain('<div id="root">');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(res.headers['strict-transport-security']).toBeDefined();
    },
  );

  it('caches fingerprinted assets forever and compresses them', async () => {
    const res = await request(app).get('/assets/index-abc123.js').set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('never answers a missing file with index.html', async () => {
    const missing = await request(app).get('/assets/index-old999.js');
    expect(missing.status).toBe(404);
    expect(missing.headers['content-type']).toMatch(/json/);
    expect((await request(app).get('/favicon-missing.png')).status).toBe(404);
  });

  it('keeps API behaviour unchanged', async () => {
    const health = await request(app).get('/api/health');
    expect(health.headers['content-type']).toMatch(/json/);
    expect(health.headers['content-security-policy']).toContain("default-src 'none'");
    const unknown = await request(app).get('/api/does-not-exist');
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('NOT_FOUND');
  });

  it('refuses to start with a directory that has no build', () => {
    expect(() => createApp({ frontendDir: join(tmpdir(), 'qrcare-no-such-build') })).toThrow(
      /index\.html/,
    );
  });
});

describe('maintenance', () => {
  beforeEach(resetDatabase);

  it('purges expired sessions, long-revoked tokens and old OTPs, keeping the rest', async () => {
    const user = await createCustomer();
    const day = 24 * 60 * 60 * 1000;
    const now = new Date();
    const family = '00000000-0000-4000-8000-000000000001';
    await db.insert(refreshTokens).values([
      {
        userId: user.id,
        familyId: family,
        tokenHash: 'expired',
        expiresAt: new Date(now.getTime() - day),
      },
      {
        userId: user.id,
        familyId: family,
        tokenHash: 'revoked-long-ago',
        expiresAt: new Date(now.getTime() + day),
        revokedAt: new Date(now.getTime() - 40 * day),
      },
      {
        userId: user.id,
        familyId: family,
        tokenHash: 'recently-revoked',
        expiresAt: new Date(now.getTime() + day),
        revokedAt: new Date(now.getTime() - day),
      },
      {
        userId: user.id,
        familyId: family,
        tokenHash: 'live',
        expiresAt: new Date(now.getTime() + day),
      },
    ]);
    await db.insert(otpVerifications).values([
      {
        userId: user.id,
        channel: 'EMAIL',
        purpose: 'PASSWORD_RESET',
        otpHash: 'old',
        expiresAt: new Date(now.getTime() - 2 * day),
        createdAt: new Date(now.getTime() - 2 * day),
      },
      {
        userId: user.id,
        channel: 'EMAIL',
        purpose: 'PASSWORD_RESET',
        otpHash: 'fresh',
        expiresAt: new Date(now.getTime() + 60_000),
      },
    ]);

    expect(await purgeStaleAuthRecords(now)).toEqual({ refreshTokens: 2, otps: 1 });

    const tokens = (await db.select().from(refreshTokens)).map((t) => t.tokenHash).sort();
    expect(tokens).toEqual(['live', 'recently-revoked']);
    const otps = await db
      .select()
      .from(otpVerifications)
      .where(eq(otpVerifications.userId, user.id));
    expect(otps.map((o) => o.otpHash)).toEqual(['fresh']);
  });
});
