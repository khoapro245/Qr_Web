import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/client.js';
import { customerProfiles, qrCodes } from '../../src/db/schema.js';
import { insertCustomerProfile, insertUser, pgErrorCode, resetDatabase } from '../helpers/db.js';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';

async function expectPgError(promise: Promise<unknown>, code: string) {
  const err: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected Postgres error ${code}`).not.toBeNull();
  expect(pgErrorCode(err)).toBe(code);
}

describe('database schema', () => {
  beforeEach(resetDatabase);

  it('has all expected tables after migrations', async () => {
    const result = await db.execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    expect(result.rows.map((r) => r.table_name)).toEqual([
      'audit_logs',
      'customer_profiles',
      'otp_verifications',
      'qr_codes',
      'refresh_tokens',
      'users',
    ]);
  });

  describe('users', () => {
    it('requires an email or a phone', async () => {
      await expectPgError(insertUser({ email: null, phone: null }), CHECK_VIOLATION);
    });

    it('accepts phone-only accounts', async () => {
      const user = await insertUser({ email: null, phone: '+84912345678' });
      expect(user.phone).toBe('+84912345678');
    });

    it('enforces unique email and phone', async () => {
      await insertUser({ email: 'dup@example.com', phone: '+84900000001' });
      await expectPgError(insertUser({ email: 'dup@example.com' }), UNIQUE_VIOLATION);
      await expectPgError(
        insertUser({ email: 'other@example.com', phone: '+84900000001' }),
        UNIQUE_VIOLATION,
      );
    });

    it('rejects non-normalised email and phone values', async () => {
      await expectPgError(insertUser({ email: 'Upper@Example.com' }), CHECK_VIOLATION);
      await expectPgError(insertUser({ phone: '0912345678' }), CHECK_VIOLATION);
    });

    it('defaults to an active account that must change its password', async () => {
      const user = await insertUser();
      expect(user.status).toBe('ACTIVE');
      expect(user.mustChangePassword).toBe(true);
      expect(user.failedLoginCount).toBe(0);
    });
  });

  describe('customer_profiles', () => {
    it('stores date of birth as a plain date without timezone shift', async () => {
      const user = await insertUser();
      await insertCustomerProfile(user.id, { dateOfBirth: '2006-03-19' });
      const [profile] = await db
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, user.id));
      expect(profile?.dateOfBirth).toBe('2006-03-19');
    });

    it('stores weight and height as numbers', async () => {
      const user = await insertUser();
      const profile = await insertCustomerProfile(user.id, { weightKg: 60.5, heightCm: 170 });
      expect(profile.weightKg).toBe(60.5);
      expect(profile.heightCm).toBe(170);
      expect(profile.bloodGroup).toBe('UNKNOWN');
    });

    it('rejects unreasonable body measurements and empty names', async () => {
      const user = await insertUser();
      await expectPgError(insertCustomerProfile(user.id, { weightKg: 0 }), CHECK_VIOLATION);
      await expectPgError(insertCustomerProfile(user.id, { heightCm: 400 }), CHECK_VIOLATION);
      await expectPgError(insertCustomerProfile(user.id, { fullName: '   ' }), CHECK_VIOLATION);
    });

    it('requires an existing user', async () => {
      await expectPgError(
        insertCustomerProfile('00000000-0000-4000-8000-000000000000'),
        FOREIGN_KEY_VIOLATION,
      );
    });
  });

  describe('qr_codes', () => {
    it('allows only one active QR per customer', async () => {
      const user = await insertUser();
      await db.insert(qrCodes).values({ userId: user.id, token: 'token-a' });
      await expectPgError(
        db.insert(qrCodes).values({ userId: user.id, token: 'token-b' }),
        UNIQUE_VIOLATION,
      );
    });

    it('allows a new active QR once the previous one is revoked', async () => {
      const user = await insertUser();
      const [first] = await db
        .insert(qrCodes)
        .values({ userId: user.id, token: 'token-a' })
        .returning();
      await db
        .update(qrCodes)
        .set({ status: 'REVOKED', revokedAt: new Date() })
        .where(eq(qrCodes.id, first!.id));
      await db.insert(qrCodes).values({ userId: user.id, token: 'token-b' });

      const rows = await db.select().from(qrCodes).where(eq(qrCodes.userId, user.id));
      expect(rows.map((r) => r.status).sort()).toEqual(['ACTIVE', 'REVOKED']);
    });

    it('keeps tokens globally unique', async () => {
      const a = await insertUser();
      const b = await insertUser();
      await db.insert(qrCodes).values({ userId: a.id, token: 'same-token' });
      await expectPgError(
        db.insert(qrCodes).values({ userId: b.id, token: 'same-token' }),
        UNIQUE_VIOLATION,
      );
    });

    it('requires revoked_at exactly when status is REVOKED', async () => {
      const user = await insertUser();
      await expectPgError(
        db.insert(qrCodes).values({ userId: user.id, token: 't1', status: 'REVOKED' }),
        CHECK_VIOLATION,
      );
      await expectPgError(
        db.insert(qrCodes).values({ userId: user.id, token: 't2', revokedAt: new Date() }),
        CHECK_VIOLATION,
      );
    });
  });
});
