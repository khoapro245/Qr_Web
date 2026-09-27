import { calculateAge } from '@qrcare/shared';
import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { customerProfiles } from '../src/db/schema.js';
import { createAdmin, loggedInClient, type TestClient } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();

const PUBLIC_FIELDS = [
  'address',
  'age',
  'avatarUrl',
  'bloodGroup',
  'dateOfBirth',
  'familyPhone',
  'fullName',
  'gender',
  'heightCm',
  'weightKg',
].sort();

let admin: TestClient;
let customerId: string;
let token: string;

function tokenOf(url: string): string {
  return url.split('/qr/')[1]!;
}

async function scan(value: string) {
  return request(app).get(`/api/qr/${encodeURIComponent(value)}`);
}

describe('public QR profile', () => {
  beforeEach(async () => {
    await resetDatabase();
    await rm(env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
    await createAdmin({ email: 'admin@example.com' });
    admin = await loggedInClient(app, 'admin@example.com');
    const created = await admin.post('/api/admin/users', {
      fullName: 'Nguyễn Văn A',
      dateOfBirth: '2006-03-19',
      gender: 'MALE',
      address: '12 Lê Lợi, Quận 1',
      familyPhone: '0987654321',
      bloodGroup: 'O+',
      weightKg: 60,
      heightCm: 170,
      email: 'private@example.com',
      phone: '0912345678',
      password: 'SecretPass123',
      publicConsent: true,
    });
    customerId = created.body.data.customer.id;
    token = tokenOf(created.body.data.customer.qr.url);
  });

  it('shows exactly the whitelisted fields without logging in', async () => {
    const res = await scan(token);
    expect(res.status).toBe(200);
    const { profile } = res.body.data;
    expect(Object.keys(profile).sort()).toEqual(PUBLIC_FIELDS);
    expect(profile).toMatchObject({
      fullName: 'Nguyễn Văn A',
      dateOfBirth: '2006-03-19',
      age: calculateAge('2006-03-19'),
      gender: 'MALE',
      address: '12 Lê Lợi, Quận 1',
      familyPhone: '+84987654321',
      bloodGroup: 'O+',
      weightKg: 60,
      heightCm: 170,
      avatarUrl: null,
    });
  });

  it('never exposes authentication data or internal identifiers', async () => {
    const body = JSON.stringify((await scan(token)).body);
    for (const secret of [
      'private@example.com',
      '+84912345678',
      '0912345678',
      'SecretPass123',
      'argon2',
      customerId,
      'ACTIVE',
      'CUSTOMER',
    ]) {
      expect(body).not.toContain(secret);
    }
  });

  it('sets privacy headers', async () => {
    const res = await scan(token);
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  describe('unavailable codes all look the same', () => {
    async function expectUnavailable(value: string) {
      const res = await scan(value);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        code: 'QR_NOT_FOUND',
        message: 'QR code is invalid or has been revoked',
      });
    }

    it.each([
      ['an unknown token', 'AAAAAAAAAAAAAAAAAAAAAA'],
      ['a too short token', 'abc'],
      ['a sequential id', '1'],
      ['an SQL injection attempt', "' OR '1'='1"],
      ['a path traversal attempt', '..%2F..%2Fadmin'],
    ])('rejects %s', async (_label, value) => {
      await expectUnavailable(value);
    });

    it('stops the old code after regeneration while the new one works', async () => {
      const regenerated = await admin.post(`/api/admin/users/${customerId}/qr/regenerate`);
      const newToken = tokenOf(regenerated.body.data.current.url);
      await expectUnavailable(token);
      expect((await scan(newToken)).status).toBe(200);
    });

    it('stops a revoked code', async () => {
      await admin.post(`/api/admin/users/${customerId}/qr/revoke`);
      await expectUnavailable(token);
    });

    it('hides the profile while the account is inactive, and restores it on reactivation', async () => {
      await admin.patch(`/api/admin/users/${customerId}/status`, { status: 'INACTIVE' });
      await expectUnavailable(token);
      await admin.patch(`/api/admin/users/${customerId}/status`, { status: 'ACTIVE' });
      expect((await scan(token)).status).toBe(200);
    });

    it('hides profiles without recorded public consent', async () => {
      await db
        .update(customerProfiles)
        .set({ publicConsentAt: null })
        .where(eq(customerProfiles.userId, customerId));
      await expectUnavailable(token);
    });
  });

  describe('avatar', () => {
    beforeEach(async () => {
      const image = await sharp({
        create: { width: 300, height: 300, channels: 3, background: '#0f766e' },
      })
        .png()
        .toBuffer();
      await admin.agent
        .put(`/api/admin/users/${customerId}/avatar`)
        .set('X-CSRF-Token', admin.csrfToken)
        .attach('avatar', image, 'a.png');
    });

    it('is served through the QR token', async () => {
      const { profile } = (await scan(token)).body.data;
      expect(profile.avatarUrl).toMatch(new RegExp(`^/api/qr/${token}/avatar\\?v=[0-9a-f]{12}$`));
      const res = await request(app).get(profile.avatarUrl as string);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
    });

    it('becomes unreachable once the code is revoked', async () => {
      await admin.post(`/api/admin/users/${customerId}/qr/revoke`);
      const res = await request(app).get(`/api/qr/${token}/avatar`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('QR_NOT_FOUND');
    });
  });

  it('gives public visitors no way into other APIs', async () => {
    for (const path of [
      '/api/admin/users',
      `/api/admin/users/${customerId}`,
      '/api/admin/dashboard',
      '/api/me/profile',
    ]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
    // No listing or search endpoint exists under /api/qr.
    expect((await request(app).get('/api/qr')).status).toBe(404);
    expect((await request(app).get('/api/qr/?search=nguyen')).status).toBe(404);
  });

  it('rate-limits scripted scanning', async () => {
    const limited = createApp({ rateLimit: true });
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      statuses.push((await request(limited).get(`/api/qr/${token}`)).status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
