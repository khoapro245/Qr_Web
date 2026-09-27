import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { auditLogs, otpVerifications, users } from '../src/db/schema.js';
import { clearDevOutbox, devOutbox } from '../src/providers/dev-outbox.js';
import {
  createAdmin,
  createClient,
  createCustomer,
  loggedInClient,
  TEST_PASSWORD,
  type TestClient,
} from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();
const NEW_PASSWORD = 'Recovered2026';

let client: TestClient;

function codeSentTo(to: string): string {
  const message = [...devOutbox()].reverse().find((m) => m.to === to);
  if (!message) throw new Error(`No message was sent to ${to}`);
  const code = /\b(\d{6})\b/.exec(message.text)?.[1];
  if (!code) throw new Error('No code in message');
  return code;
}

async function requestCode(identifier: string) {
  return client.post('/api/auth/forgot-password', { identifier });
}

async function verify(identifier: string, otp: string) {
  return client.post('/api/auth/verify-otp', { identifier, otp });
}

describe('password recovery', () => {
  beforeEach(async () => {
    await resetDatabase();
    clearDevOutbox();
    await createCustomer({ email: 'lan@example.com', phone: '+84912345678' });
    client = await createClient(app);
  });

  it('recovers by email: code → reset token → new password', async () => {
    const requested = await requestCode('LAN@example.com');
    expect(requested.status).toBe(200);
    expect(requested.body).toEqual({ success: true, data: { accepted: true } });

    const [email] = devOutbox();
    expect(email).toMatchObject({ channel: 'EMAIL', to: 'lan@example.com' });
    expect(email!.subject).toBe('Mã khôi phục mật khẩu QR Care');
    const code = codeSentTo('lan@example.com');
    // The code travels only through the channel, never through the API.
    expect(JSON.stringify(requested.body)).not.toContain(code);

    const verified = await verify('lan@example.com', code);
    expect(verified.status).toBe(200);
    const { resetToken } = verified.body.data;
    expect(resetToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const reset = await client.post('/api/auth/reset-password', {
      resetToken,
      newPassword: NEW_PASSWORD,
    });
    expect(reset.status).toBe(200);

    const fresh = await createClient(app);
    expect((await fresh.login('lan@example.com', TEST_PASSWORD)).status).toBe(401);
    const login = await fresh.login('lan@example.com', NEW_PASSWORD);
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(false);

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'PASSWORD_RESET_BY_OTP'));
    expect(audit).toBeDefined();
  });

  it('recovers by phone over SMS', async () => {
    await requestCode('0912 345 678');
    const [sms] = devOutbox();
    expect(sms).toMatchObject({ channel: 'SMS', to: '+84912345678' });
    expect(sms!.text).toMatch(/^QR Care: Ma xac nhan cua ban la \d{6}/);

    const verified = await verify('0912345678', codeSentTo('+84912345678'));
    expect(verified.status).toBe(200);
  });

  it('answers identically for unknown, admin and inactive accounts, sending nothing', async () => {
    await createAdmin({ email: 'admin@example.com' });
    await createCustomer({ email: 'off@example.com', status: 'INACTIVE' });

    const known = await requestCode('lan@example.com');
    clearDevOutbox();
    for (const identifier of ['nobody@example.com', 'admin@example.com', 'off@example.com']) {
      const res = await requestCode(identifier);
      expect(res.status).toBe(known.status);
      expect(res.body).toEqual(known.body);
    }
    expect(devOutbox()).toHaveLength(0);
  });

  it('stores only a keyed hash of the code', async () => {
    await requestCode('lan@example.com');
    const code = codeSentTo('lan@example.com');
    const [row] = await db.select().from(otpVerifications);
    expect(row?.otpHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.otpHash).not.toContain(code);
  });

  it('rejects a wrong code with a generic error and locks after 5 attempts', async () => {
    await requestCode('lan@example.com');
    const code = codeSentTo('lan@example.com');
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const res = await verify('lan@example.com', wrong);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OTP_INVALID');
    }
    // Attempts are used up: even the right code no longer works.
    expect((await verify('lan@example.com', code)).body.code).toBe('OTP_INVALID');
  });

  it('cannot be brute-forced with parallel guesses', async () => {
    await requestCode('lan@example.com');
    const code = codeSentTo('lan@example.com');
    const guesses = Array.from({ length: 20 }, (_, i) =>
      String((Number(code) + i + 1) % 1_000_000).padStart(6, '0'),
    );
    await Promise.all(guesses.map((guess) => verify('lan@example.com', guess)));
    const [row] = await db.select().from(otpVerifications);
    expect(row?.attemptCount).toBe(5);
    expect((await verify('lan@example.com', code)).status).toBe(400);
  });

  it('rejects expired codes', async () => {
    await requestCode('lan@example.com');
    const code = codeSentTo('lan@example.com');
    await db.update(otpVerifications).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await verify('lan@example.com', code)).body.code).toBe('OTP_INVALID');
  });

  it('gives an unknown identifier the same verification error', async () => {
    const res = await verify('nobody@example.com', '123456');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('uses each code and each reset token only once', async () => {
    await requestCode('lan@example.com');
    const code = codeSentTo('lan@example.com');
    const { resetToken } = (await verify('lan@example.com', code)).body.data;
    expect((await verify('lan@example.com', code)).status).toBe(400);

    const first = await client.post('/api/auth/reset-password', {
      resetToken,
      newPassword: NEW_PASSWORD,
    });
    expect(first.status).toBe(200);
    const replay = await client.post('/api/auth/reset-password', {
      resetToken,
      newPassword: 'Another2026pass',
    });
    expect(replay.status).toBe(400);
    expect(replay.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('expires the reset token', async () => {
    await requestCode('lan@example.com');
    const { resetToken } = (await verify('lan@example.com', codeSentTo('lan@example.com'))).body
      .data;
    await db.update(otpVerifications).set({ resetTokenExpiresAt: new Date(Date.now() - 1000) });
    const res = await client.post('/api/auth/reset-password', {
      resetToken,
      newPassword: NEW_PASSWORD,
    });
    expect(res.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('invalidates the previous code when a new one is sent', async () => {
    await requestCode('lan@example.com');
    const first = codeSentTo('lan@example.com');
    // Skip the resend cooldown.
    await db.update(otpVerifications).set({ createdAt: new Date(Date.now() - 2 * 60 * 1000) });
    await requestCode('lan@example.com');
    const second = codeSentTo('lan@example.com');
    expect(devOutbox()).toHaveLength(2);

    if (first !== second) {
      expect((await verify('lan@example.com', first)).status).toBe(400);
    }
    expect((await verify('lan@example.com', second)).status).toBe(200);
  });

  it('enforces the resend cooldown silently', async () => {
    await requestCode('lan@example.com');
    const again = await requestCode('lan@example.com');
    expect(again.body).toEqual({ success: true, data: { accepted: true } });
    expect(devOutbox()).toHaveLength(1);
  });

  it('caps the number of codes per hour', async () => {
    for (let i = 0; i < 7; i++) {
      await db.update(otpVerifications).set({ createdAt: new Date(Date.now() - 2 * 60 * 1000) });
      await requestCode('lan@example.com');
    }
    expect(devOutbox()).toHaveLength(5);
  });

  it('ends existing sessions after a reset', async () => {
    const session = await loggedInClient(app, 'lan@example.com');
    expect((await session.get('/api/me/profile')).status).toBe(200);

    await requestCode('lan@example.com');
    const { resetToken } = (await verify('lan@example.com', codeSentTo('lan@example.com'))).body
      .data;
    await client.post('/api/auth/reset-password', { resetToken, newPassword: NEW_PASSWORD });

    expect((await session.get('/api/me/profile')).status).toBe(401);
  });

  it('clears a login lockout after a successful reset', async () => {
    await db
      .update(users)
      .set({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) })
      .where(eq(users.email, 'lan@example.com'));
    await requestCode('lan@example.com');
    const { resetToken } = (await verify('lan@example.com', codeSentTo('lan@example.com'))).body
      .data;
    await client.post('/api/auth/reset-password', { resetToken, newPassword: NEW_PASSWORD });
    expect((await client.login('lan@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('validates input', async () => {
    expect((await requestCode('not an identifier')).status).toBe(400);
    expect((await verify('lan@example.com', '12ab56')).status).toBe(400);
    const weak = await client.post('/api/auth/reset-password', {
      resetToken: 'x'.repeat(43),
      newPassword: 'short',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.details[0].path).toBe('newPassword');
  });

  it('rate-limits code requests per IP', async () => {
    const limited = createApp({ rateLimit: true });
    const limitedClient = await createClient(limited);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (await limitedClient.post('/api/auth/forgot-password', { identifier: 'x@example.com' }))
          .status,
      );
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('requires CSRF protection like every other state change', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: 'lan@example.com' });
    expect(res.status).toBe(403);
  });
});
