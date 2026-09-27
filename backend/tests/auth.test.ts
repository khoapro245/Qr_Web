import { eq, isNotNull } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { COOKIE_NAMES } from '../src/config/auth.js';
import { db } from '../src/db/client.js';
import { refreshTokens, users } from '../src/db/schema.js';
import {
  createAdmin,
  createClient,
  createCustomer,
  getCookie,
  loggedInClient,
  TEST_PASSWORD,
} from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();

describe('auth', () => {
  beforeEach(resetDatabase);

  describe('CSRF protection', () => {
    it('rejects state-changing requests without a CSRF token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'a@example.com', password: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('rejects a token that does not match the cookie', async () => {
      const client = await createClient(app);
      const res = await client.agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', 'forged')
        .send({ identifier: 'a@example.com', password: 'x' });
      expect(res.status).toBe(403);
    });

    it('rejects requests from a foreign origin', async () => {
      const client = await createClient(app);
      const res = await client.agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', client.csrfToken)
        .set('Origin', 'https://evil.example')
        .send({ identifier: 'a@example.com', password: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
    });
  });

  describe('login', () => {
    it('logs an admin in by email and sets hardened session cookies', async () => {
      await createAdmin({ email: 'admin@example.com' });
      const client = await createClient(app);
      const res = await client.login('  ADMIN@example.com ');

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        role: 'ADMIN',
        email: 'admin@example.com',
        mustChangePassword: false,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|argon2/);

      const access = getCookie(res, COOKIE_NAMES.access);
      const refresh = getCookie(res, COOKIE_NAMES.refresh);
      expect(access).toMatch(/HttpOnly/);
      expect(access).toMatch(/SameSite=Strict/);
      expect(access).toMatch(/Path=\/api;/);
      expect(refresh).toMatch(/HttpOnly/);
      expect(refresh).toMatch(/Path=\/api\/auth/);
    });

    it.each(['0912345678', '0912 345 678', '+84912345678', '0912.345.678'])(
      'logs a customer in by phone written as %s',
      async (phone) => {
        await createCustomer({ email: null, phone: '+84912345678' });
        const client = await createClient(app);
        const res = await client.login(phone);
        expect(res.status).toBe(200);
        expect(res.body.data.user.role).toBe('CUSTOMER');
        expect(res.body.data.user.displayName).toBe('Nguyễn Văn A');
      },
    );

    it('returns the same error for unknown accounts and wrong passwords', async () => {
      await createCustomer({ email: 'known@example.com' });
      const client = await createClient(app);

      const wrongPassword = await client.login('known@example.com', 'WrongPass1');
      const unknownUser = await client.login('nobody@example.com', 'WrongPass1');

      expect(wrongPassword.status).toBe(401);
      expect(unknownUser.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownUser.body);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects a malformed identifier with a validation error', async () => {
      const client = await createClient(app);
      const res = await client.login('not-a-phone');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('locks the account after 5 failed attempts, even for the right password', async () => {
      await createCustomer({ email: 'victim@example.com' });
      const client = await createClient(app);
      for (let i = 0; i < 5; i++) {
        expect((await client.login('victim@example.com', 'WrongPass1')).status).toBe(401);
      }
      const res = await client.login('victim@example.com', TEST_PASSWORD);
      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
      expect(res.body.details.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('resets the failure counter after a successful login', async () => {
      const user = await createCustomer({ email: 'c@example.com' });
      const client = await createClient(app);
      await client.login('c@example.com', 'WrongPass1');
      await client.login('c@example.com');
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      expect(row?.failedLoginCount).toBe(0);
      expect(row?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('refuses inactive accounts (only after the correct password)', async () => {
      await createCustomer({ email: 'off@example.com', status: 'INACTIVE' });
      const client = await createClient(app);
      expect((await client.login('off@example.com', 'WrongPass1')).body.code).toBe(
        'INVALID_CREDENTIALS',
      );
      const res = await client.login('off@example.com');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('session', () => {
    it('GET /me requires authentication', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('GET /me returns the signed-in user', async () => {
      await createAdmin({ email: 'admin@example.com' });
      const client = await loggedInClient(app, 'admin@example.com');
      const res = await client.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@example.com');
    });

    it('rejects forged and tampered access tokens', async () => {
      const forged =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIn0.c2lnbmF0dXJlLWZvcmdlZA';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `${COOKIE_NAMES.access}=${forged}`);
      expect(res.status).toBe(401);
    });

    it('ends the session immediately when the account is deactivated', async () => {
      const user = await createCustomer({ email: 'c@example.com' });
      const client = await loggedInClient(app, 'c@example.com');
      await db.update(users).set({ status: 'INACTIVE' }).where(eq(users.id, user.id));
      const res = await client.get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('ACCOUNT_INACTIVE');
    });

    it('rotates the refresh token and keeps the session working', async () => {
      await createAdmin({ email: 'admin@example.com' });
      const client = await loggedInClient(app, 'admin@example.com');
      const res = await client.post('/api/auth/refresh');
      expect(res.status).toBe(200);
      expect(getCookie(res, COOKIE_NAMES.refresh)).toBeDefined();
      expect((await client.get('/api/auth/me')).status).toBe(200);

      const rows = await db.select().from(refreshTokens);
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
    });

    it('treats immediate reuse of a rotated refresh token as a benign race', async () => {
      await createAdmin({ email: 'admin@example.com' });
      const client = await createClient(app);
      const loginRes = await client.login('admin@example.com');
      const oldRefresh = getCookie(loginRes, COOKIE_NAMES.refresh)!.split(';')[0]!;

      await client.post('/api/auth/refresh');
      const replay = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [oldRefresh, `${COOKIE_NAMES.csrf}=${client.csrfToken}`])
        .set('X-CSRF-Token', client.csrfToken);
      expect(replay.status).toBe(409);
      expect((await client.get('/api/auth/me')).status).toBe(200);
    });

    it('revokes the whole session when an old refresh token is replayed later', async () => {
      await createAdmin({ email: 'admin@example.com' });
      const client = await createClient(app);
      const loginRes = await client.login('admin@example.com');
      const oldRefresh = getCookie(loginRes, COOKIE_NAMES.refresh)!.split(';')[0]!;

      await client.post('/api/auth/refresh');
      // Pretend the rotation of the old token happened long ago (outside the grace window).
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(Date.now() - 60 * 60 * 1000) })
        .where(isNotNull(refreshTokens.replacedById));
      expect((await client.get('/api/auth/me')).status).toBe(200);

      const replay = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [oldRefresh, `${COOKIE_NAMES.csrf}=${client.csrfToken}`])
        .set('X-CSRF-Token', client.csrfToken);
      expect(replay.status).toBe(401);
      // The legitimate client's session is gone too.
      expect((await client.get('/api/auth/me')).status).toBe(401);
      expect((await client.post('/api/auth/refresh')).status).toBe(401);
    });

    it('logout revokes the session so a copied access token stops working', async () => {
      await createAdmin({ email: 'admin@example.com' });
      const client = await createClient(app);
      const loginRes = await client.login('admin@example.com');
      const stolenAccess = getCookie(loginRes, COOKIE_NAMES.access)!.split(';')[0]!;

      const res = await client.post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(getCookie(res, COOKIE_NAMES.access)).toMatch(/Expires=Thu, 01 Jan 1970/);

      const replay = await request(app).get('/api/auth/me').set('Cookie', stolenAccess);
      expect(replay.status).toBe(401);
    });
  });

  describe('password change', () => {
    it('forces a password change before anything else', async () => {
      await createAdmin({ email: 'new@example.com', mustChangePassword: true });
      const client = await loggedInClient(app, 'new@example.com');

      expect((await client.get('/api/auth/me')).body.data.user.mustChangePassword).toBe(true);
      const blocked = await client.get('/api/admin/dashboard');
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

      const change = await client.post('/api/auth/change-password', {
        currentPassword: TEST_PASSWORD,
        newPassword: 'BrandNew2024',
      });
      expect(change.status).toBe(200);
      expect(change.body.data.user.mustChangePassword).toBe(false);
      expect((await client.get('/api/admin/dashboard')).status).toBe(200);
    });

    it('rejects a wrong current password', async () => {
      await createCustomer({ email: 'c@example.com' });
      const client = await loggedInClient(app, 'c@example.com');
      const res = await client.post('/api/auth/change-password', {
        currentPassword: 'WrongPass1',
        newPassword: 'BrandNew2024',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it.each([
      ['too short', 'Ab1'],
      ['no digit', 'OnlyLetters'],
      ['no letter', '1234567890'],
      ['same as current', TEST_PASSWORD],
    ])('rejects a weak new password (%s)', async (_label, newPassword) => {
      await createCustomer({ email: 'c@example.com' });
      const client = await loggedInClient(app, 'c@example.com');
      const res = await client.post('/api/auth/change-password', {
        currentPassword: TEST_PASSWORD,
        newPassword,
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details[0].path).toBe('newPassword');
    });

    it('invalidates the old password and all other sessions', async () => {
      await createCustomer({ email: 'c@example.com' });
      const phone = await loggedInClient(app, 'c@example.com');
      const laptop = await loggedInClient(app, 'c@example.com');

      const change = await laptop.post('/api/auth/change-password', {
        currentPassword: TEST_PASSWORD,
        newPassword: 'BrandNew2024',
      });
      expect(change.status).toBe(200);

      expect((await laptop.get('/api/auth/me')).status).toBe(200);
      expect((await phone.get('/api/auth/me')).status).toBe(401);

      const fresh = await createClient(app);
      expect((await fresh.login('c@example.com', TEST_PASSWORD)).status).toBe(401);
      expect((await fresh.login('c@example.com', 'BrandNew2024')).status).toBe(200);
    });
  });

  describe('authorization', () => {
    it('lets admins reach admin endpoints', async () => {
      await createAdmin({ email: 'admin@example.com' });
      await createCustomer();
      const client = await loggedInClient(app, 'admin@example.com');
      const res = await client.get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.data.stats).toMatchObject({ totalCustomers: 1, activeCustomers: 1 });
    });

    it('forbids customers from admin endpoints', async () => {
      await createCustomer({ email: 'c@example.com' });
      const client = await loggedInClient(app, 'c@example.com');
      const res = await client.get('/api/admin/dashboard');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('forbids anonymous visitors from admin endpoints', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('uses the role from the database, not the token', async () => {
      const admin = await createAdmin({ email: 'admin@example.com' });
      const client = await loggedInClient(app, 'admin@example.com');
      await db.update(users).set({ role: 'CUSTOMER' }).where(eq(users.id, admin.id));
      expect((await client.get('/api/admin/dashboard')).status).toBe(403);
    });
  });

  describe('rate limiting', () => {
    it('throttles repeated login attempts from one IP', async () => {
      const limitedApp = createApp({ rateLimit: true });
      const client = await createClient(limitedApp);
      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) {
        statuses.push((await client.login('nobody@example.com', 'WrongPass1')).status);
      }
      expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
      expect(statuses[20]).toBe(429);
    });
  });
});
