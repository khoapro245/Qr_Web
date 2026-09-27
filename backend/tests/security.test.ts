import type { Router } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { createRateLimiters } from '../src/middleware/rate-limit.js';
import { createAdminRouter } from '../src/routes/admin.routes.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createMeRouter } from '../src/routes/me.routes.js';
import { createPublicQrRouter } from '../src/routes/public.routes.js';
import { serializeError } from '../src/utils/safe-error.js';
import {
  createAdmin,
  createClient,
  createCustomer,
  loggedInClient,
  type TestClient,
} from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();
const SOME_ID = '00000000-0000-4000-8000-000000000000';
const SOME_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

interface RouteInfo {
  method: string;
  path: string;
}

/** Every route registered on a router — new endpoints are covered automatically. */
function routesOf(router: Router, prefix: string): RouteInfo[] {
  const stack = (
    router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }
  ).stack;
  return stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route!.methods)
        .filter((m) => m !== '_all')
        .map((method) => ({
          method: method.toUpperCase(),
          path: prefix + layer.route!.path.replace(':id', SOME_ID).replace(':token', SOME_TOKEN),
        })),
    );
}

const limiters = createRateLimiters(false);
const ADMIN_ROUTES = routesOf(createAdminRouter(limiters), '/api/admin');
const ME_ROUTES = routesOf(createMeRouter(), '/api/me');
const AUTH_ROUTES = routesOf(createAuthRouter(limiters), '/api/auth');
const PUBLIC_ROUTES = routesOf(createPublicQrRouter(limiters), '/api/qr');
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function send(client: TestClient | ReturnType<typeof request>, { method, path }: RouteInfo) {
  const agent = 'agent' in client ? client.agent : client;
  const req = agent[method.toLowerCase() as 'get'](path);
  return 'agent' in client && UNSAFE.has(method) ? req.set('X-CSRF-Token', client.csrfToken) : req;
}

describe('security: route inventory', () => {
  let anonymous: TestClient;
  let admin: TestClient;
  let customer: TestClient;

  beforeAll(async () => {
    await resetDatabase();
    await createAdmin({ email: 'admin@example.com' });
    await createCustomer({ email: 'c@example.com' });
    anonymous = await createClient(app);
    admin = await loggedInClient(app, 'admin@example.com');
    customer = await loggedInClient(app, 'c@example.com');
  });

  it('discovers the expected number of routes', () => {
    // dashboard + 6 customer + 3 avatar + 5 QR routes
    expect(ADMIN_ROUTES.length).toBeGreaterThanOrEqual(15);
    expect(ME_ROUTES.length).toBeGreaterThanOrEqual(3);
  });

  it.each(ADMIN_ROUTES.map((r) => [`${r.method} ${r.path}`, r] as const))(
    'admin route %s requires an admin',
    async (_label, route) => {
      expect((await send(anonymous, route)).status).toBe(401);
      const asCustomer = await send(customer, route);
      expect(asCustomer.status).toBe(403);
      expect(asCustomer.body.code).toBe('FORBIDDEN');
    },
  );

  it.each(ME_ROUTES.map((r) => [`${r.method} ${r.path}`, r] as const))(
    'customer route %s requires a customer',
    async (_label, route) => {
      expect((await send(anonymous, route)).status).toBe(401);
      expect((await send(admin, route)).status).toBe(403);
    },
  );

  it.each(
    [...ADMIN_ROUTES, ...ME_ROUTES, ...AUTH_ROUTES, ...PUBLIC_ROUTES]
      .filter((r) => UNSAFE.has(r.method))
      .map((r) => [`${r.method} ${r.path}`, r] as const),
  )('state-changing route %s requires a CSRF token', async (_label, route) => {
    // A signed-in admin, but no X-CSRF-Token header.
    const res = await admin.agent[route.method.toLowerCase() as 'post'](route.path).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('exposes no hard-delete of customers', async () => {
    const res = await admin.agent
      .delete(`/api/admin/users/${SOME_ID}`)
      .set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(404);
  });
});

describe('security: token forgery', () => {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = { sub: SOME_ID, role: 'ADMIN', sid: SOME_ID, iat: 1, exp: 9_999_999_999 };

  it('rejects unsigned (alg=none) tokens', async () => {
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
    const res = await request(app).get('/api/admin/dashboard').set('Cookie', `qrc_at=${token}`);
    expect(res.status).toBe(401);
  });

  it('ignores Authorization headers — sessions live in HttpOnly cookies only', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer anything');
    expect(res.status).toBe(401);
  });
});

describe('security: hostile input', () => {
  let admin: TestClient;

  beforeAll(async () => {
    await resetDatabase();
    await createAdmin({ email: 'admin@example.com' });
    admin = await loggedInClient(app, 'admin@example.com');
  });

  it('answers malformed URL encoding with 400, not 500', async () => {
    const res = await admin.get('/api/admin/users/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      code: 'BAD_REQUEST',
      message: 'The request could not be understood',
    });
  });

  it('rejects NUL bytes, which PostgreSQL cannot store', async () => {
    const search = await admin.get('/api/admin/users?search=Nguy%00en');
    expect(search.status).toBe(400);
    expect(search.body.code).toBe('INVALID_INPUT');

    const login = await (await createClient(app)).login('a\u0000@example.com', 'x');
    expect(login.status).toBe(400);
  });

  it.each([
    ["SQL in search: ' OR 1=1 --", "' OR 1=1 --"],
    ['SQL in search: DROP TABLE', "'; DROP TABLE users; --"],
    ['LIKE wildcards', '%_%'],
    ['backslash', '\\'],
  ])('handles %s safely', async (_label, payload) => {
    const res = await admin.get(`/api/admin/users?search=${encodeURIComponent(payload)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });

  it('rejects object-injection in login fields', async () => {
    const client = await createClient(app);
    const res = await client.post('/api/auth/login', {
      identifier: { $ne: null },
      password: { $gt: '' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects duplicated query parameters instead of crashing', async () => {
    const res = await admin.get('/api/admin/users?status=ACTIVE&status=INACTIVE');
    expect(res.status).toBe(400);
  });

  it('handles a non-JSON body on a JSON endpoint', async () => {
    const res = await admin.agent
      .put(`/api/admin/users/${SOME_ID}`)
      .set('X-CSRF-Token', admin.csrfToken)
      .type('form')
      .send('fullName=x');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized JSON bodies', async () => {
    const res = await admin.agent
      .post('/api/admin/users')
      .set('X-CSRF-Token', admin.csrfToken)
      .set('Content-Type', 'application/json')
      .send(`{"fullName":"${'x'.repeat(200_000)}"}`);
    expect(res.status).toBe(413);
  });

  it('ignores prototype-pollution keys', async () => {
    const res = await admin.agent
      .post('/api/admin/users')
      .set('X-CSRF-Token', admin.csrfToken)
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"polluted":1}}}');
    expect(res.status).toBe(400);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('security: transport and headers', () => {
  it('sends hardening headers on API responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not grant CORS access to other origins', async () => {
    const res = await request(app)
      .options('/api/admin/users')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('does not trust X-Forwarded-For by default, so it cannot dodge rate limits', async () => {
    const limited = createApp({ rateLimit: true });
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const client = await createClient(limited);
      const res = await client.agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', client.csrfToken)
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .send({ identifier: 'nobody@example.com', password: 'Wrong12345' });
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('security: logging', () => {
  it('strips query parameters and row values from database errors', () => {
    const pgError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'users_email_key',
      detail: 'Key (email)=(secret@example.com) already exists.',
    });
    const queryError = Object.assign(
      new Error(
        'Failed query: insert into "users" values ($1, $2)\nparams: secret@example.com,$argon2id$hash',
      ),
      {
        name: 'DrizzleQueryError',
        query: 'insert into "users" values ($1, $2)',
        params: ['secret@example.com', '$argon2id$hash'],
        cause: pgError,
      },
    );
    const logged = JSON.stringify(serializeError(queryError));
    expect(logged).not.toContain('secret@example.com');
    expect(logged).not.toContain('argon2id');
    expect(logged).toContain('users_email_key');
    expect(logged).toContain('23505');

    const direct = JSON.stringify(serializeError(pgError));
    expect(direct).not.toContain('secret@example.com');
  });
});

describe('security: production configuration', () => {
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://u:p@db:5432/qrcare',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    OTP_SECRET: 'b'.repeat(48),
    PUBLIC_QR_BASE_URL: 'https://qr.example.vn',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.vn',
    SMS_PROVIDER: 'disabled',
  };

  it('accepts a complete production configuration with secure cookies', () => {
    const result = parseEnv(production);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.env.COOKIE_SECURE).toBe(true);
  });

  it.each([
    [
      'placeholder JWT secret',
      { JWT_ACCESS_SECRET: 'change-me-to-a-long-random-secret-at-least-32' },
      'JWT_ACCESS_SECRET',
    ],
    ['short OTP secret', { OTP_SECRET: 'short' }, 'OTP_SECRET'],
    ['OTPs printed to logs (email)', { EMAIL_PROVIDER: 'console' }, 'EMAIL_PROVIDER'],
    ['OTPs printed to logs (SMS)', { SMS_PROVIDER: 'console' }, 'SMS_PROVIDER'],
    [
      'QR links over plain HTTP',
      { PUBLIC_QR_BASE_URL: 'http://qr.example.vn' },
      'PUBLIC_QR_BASE_URL',
    ],
    ['missing QR domain', { PUBLIC_QR_BASE_URL: undefined }, 'PUBLIC_QR_BASE_URL'],
    ['SMTP without host', { SMTP_HOST: undefined }, 'SMTP_HOST'],
    ['the test-only OTP file', { DEV_OUTBOX_FILE: '/tmp/outbox.jsonl' }, 'DEV_OUTBOX_FILE'],
  ])('refuses to start with %s', (_label, override, variable) => {
    const result = parseEnv({ ...production, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.invalid).toContain(variable);
  });

  it('reports variable names but never their values', () => {
    const result = parseEnv({
      ...production,
      JWT_ACCESS_SECRET: 'change-me-SECRET-VALUE-0123456789',
    });
    expect(JSON.stringify(result)).not.toContain('SECRET-VALUE');
  });
});
