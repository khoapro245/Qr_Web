import { and, eq } from 'drizzle-orm';
import jsQR from 'jsqr';
import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { auditLogs, qrCodes } from '../src/db/schema.js';
import { fileSlug } from '../src/services/qr.service.js';
import { redactUrl } from '../src/utils/logger.js';
import { createAdmin, createClient, loggedInClient, type TestClient } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const customerInput = {
  fullName: 'Nguyễn Văn Đức',
  dateOfBirth: '2006-03-19',
  gender: 'MALE',
  familyPhone: '0987654321',
  email: 'duc@example.com',
  phone: '0912345678',
  password: '',
  publicConsent: true,
};

let admin: TestClient;

async function createCustomer(overrides: Record<string, unknown> = {}) {
  const res = await admin.post('/api/admin/users', { ...customerInput, ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.customer as { id: string; qr: { url: string; id: string } | null };
}

function tokenOf(url: string): string {
  return url.slice(`${env.PUBLIC_QR_BASE_URL}/qr/`.length);
}

async function decodePng(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // jsqr is CommonJS; under NodeNext its function is exposed as `.default`.
  return jsQR.default(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe('QR codes', () => {
  beforeEach(async () => {
    await resetDatabase();
    await createAdmin({ email: 'admin@example.com' });
    admin = await loggedInClient(app, 'admin@example.com');
  });

  describe('token generation', () => {
    it('issues an active QR automatically when a customer is created', async () => {
      const customer = await createCustomer();
      expect(customer.qr).not.toBeNull();
      expect(customer.qr!.url.startsWith(`${env.PUBLIC_QR_BASE_URL}/qr/`)).toBe(true);
      expect(tokenOf(customer.qr!.url)).toMatch(TOKEN_PATTERN);

      const [entry] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'QR_GENERATED'));
      expect(entry?.metadata).toEqual({ qrId: customer.qr!.id });
      // The secret token never reaches the audit log.
      expect(JSON.stringify(entry)).not.toContain(tokenOf(customer.qr!.url));
    });

    it('uses unpredictable tokens unrelated to the customer', async () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const customer = await createCustomer({
          email: `c${i}@example.com`,
          phone: `09123456${String(i).padStart(2, '0')}`,
        });
        const token = tokenOf(customer.qr!.url);
        expect(token).toMatch(TOKEN_PATTERN);
        expect(token).not.toContain(customer.id.replace(/-/g, '').slice(0, 8));
        expect(token).not.toMatch(/2006|0319|0912|0987/);
        tokens.add(token);
      }
      expect(tokens.size).toBe(12);
    });
  });

  describe('lifecycle', () => {
    it('lists the current code and its history', async () => {
      const { id } = await createCustomer();
      const res = await admin.get(`/api/admin/users/${id}/qr`);
      expect(res.status).toBe(200);
      expect(res.body.data.current.status).toBe('ACTIVE');
      expect(res.body.data.history).toHaveLength(1);
    });

    it('refuses to generate a second active code', async () => {
      const { id } = await createCustomer();
      const res = await admin.post(`/api/admin/users/${id}/qr`);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('QR_ALREADY_ACTIVE');
    });

    it('regenerates: revokes the old code and activates a new one', async () => {
      const { id, qr: first } = await createCustomer();
      const res = await admin.post(`/api/admin/users/${id}/qr/regenerate`);
      expect(res.status).toBe(201);

      const { current, history } = res.body.data;
      expect(current.url).not.toBe(first!.url);
      expect(tokenOf(current.url)).toMatch(TOKEN_PATTERN);
      expect(history).toHaveLength(2);
      const old = history.find((q: { id: string }) => q.id === first!.id);
      expect(old).toMatchObject({ status: 'REVOKED', url: null });
      expect(old.revokedAt).not.toBeNull();
      expect(old.tokenHint).toBe(tokenOf(first!.url).slice(-4));

      const active = await db
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.userId, id), eq(qrCodes.status, 'ACTIVE')));
      expect(active).toHaveLength(1);

      const [audit] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'QR_REGENERATED'));
      expect(audit?.metadata).toEqual({ qrId: current.id, previousQrId: first!.id });
    });

    it('keeps exactly one active code under concurrent regeneration', async () => {
      const { id } = await createCustomer();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => admin.post(`/api/admin/users/${id}/qr/regenerate`)),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      const active = await db
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.userId, id), eq(qrCodes.status, 'ACTIVE')));
      expect(active).toHaveLength(1);
      expect(await db.select().from(qrCodes).where(eq(qrCodes.userId, id))).toHaveLength(6);
    });

    it('revokes without replacement, then allows generating again', async () => {
      const { id } = await createCustomer();
      const revoked = await admin.post(`/api/admin/users/${id}/qr/revoke`);
      expect(revoked.status).toBe(200);
      expect(revoked.body.data.current).toBeNull();

      const list = await admin.get('/api/admin/users');
      expect(list.body.data.items[0].hasActiveQr).toBe(false);
      expect((await admin.post(`/api/admin/users/${id}/qr/revoke`)).body.code).toBe('QR_NOT_FOUND');

      const again = await admin.post(`/api/admin/users/${id}/qr`);
      expect(again.status).toBe(201);
      expect(again.body.data.current.status).toBe('ACTIVE');
    });

    it('updates the dashboard counters', async () => {
      const { id } = await createCustomer();
      await admin.post(`/api/admin/users/${id}/qr/regenerate`);
      const res = await admin.get('/api/admin/dashboard');
      expect(res.body.data.stats).toMatchObject({ activeQrCodes: 1, revokedQrCodes: 1 });
    });
  });

  describe('images', () => {
    it('renders a printable PNG that encodes only the public link', async () => {
      const customer = await createCustomer();
      const res = await admin.get(`/api/admin/users/${customer.id}/qr/image?format=png`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      const meta = await sharp(res.body as Buffer).metadata();
      expect(meta.width).toBeGreaterThanOrEqual(1024);

      const decoded = await decodePng(res.body as Buffer);
      expect(decoded).toBe(customer.qr!.url);
      // No personal information inside the code itself.
      for (const secret of ['Nguyễn', 'Nguyen', 'Duc', '2006', '0912', '0987', 'duc@']) {
        expect(decoded).not.toContain(secret);
      }
    });

    it('renders an SVG and offers downloads with an ASCII file name', async () => {
      const { id } = await createCustomer();
      const svg = await admin.get(`/api/admin/users/${id}/qr/image?format=svg`);
      expect(svg.headers['content-type']).toMatch(/^image\/svg\+xml/);
      expect(String(svg.body)).toMatch(/^<svg /);

      const download = await admin.get(`/api/admin/users/${id}/qr/image?format=png&download=1`);
      expect(download.headers['content-disposition']).toBe(
        'attachment; filename="qrcare-nguyen-van-duc.png"',
      );
    });

    it('rejects unknown formats and customers without an active code', async () => {
      const { id } = await createCustomer();
      expect((await admin.get(`/api/admin/users/${id}/qr/image?format=gif`)).status).toBe(400);
      await admin.post(`/api/admin/users/${id}/qr/revoke`);
      const res = await admin.get(`/api/admin/users/${id}/qr/image`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('QR_NOT_FOUND');
    });
  });

  describe('access control', () => {
    it('is admin-only', async () => {
      const { id } = await createCustomer({ password: 'CustomerPass1' });
      const customer = await createClient(app);
      expect((await customer.login('duc@example.com', 'CustomerPass1')).status).toBe(200);
      await customer.post('/api/auth/change-password', {
        currentPassword: 'CustomerPass1',
        newPassword: 'CustomerPass2',
      });

      for (const res of [
        await customer.get(`/api/admin/users/${id}/qr`),
        await customer.post(`/api/admin/users/${id}/qr`),
        await customer.post(`/api/admin/users/${id}/qr/regenerate`),
        await customer.post(`/api/admin/users/${id}/qr/revoke`),
        await customer.get(`/api/admin/users/${id}/qr/image`),
      ]) {
        expect(res.status).toBe(403);
      }
      expect((await request(app).get(`/api/admin/users/${id}/qr`)).status).toBe(401);
    });

    it('returns 404 for unknown customers', async () => {
      const res = await admin.post('/api/admin/users/00000000-0000-4000-8000-000000000000/qr');
      expect(res.status).toBe(404);
    });
  });
});

describe('QR helpers', () => {
  it('builds ASCII file names from Vietnamese names', () => {
    expect(fileSlug('Nguyễn Văn Đức')).toBe('nguyen-van-duc');
    expect(fileSlug('  Trần   Thị Ánh!! ')).toBe('tran-thi-anh');
    expect(fileSlug('???')).toBe('khach-hang');
  });

  it('masks QR tokens and query strings in logged URLs', () => {
    expect(redactUrl('/api/qr/AbCdEfGhIjKlMnOpQrStUv')).toBe('/api/qr/[redacted]');
    expect(redactUrl('/api/qr/AbCdEfGhIjKlMnOpQrStUv/avatar?x=1')).toBe(
      '/api/qr/[redacted]/avatar',
    );
    expect(redactUrl('/api/admin/users?search=nguyen')).toBe('/api/admin/users');
  });
});
