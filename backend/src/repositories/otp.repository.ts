import type { OtpChannel } from '@qrcare/shared';
import { and, count, desc, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client.js';
import { otpVerifications, type OtpVerification } from '../db/schema.js';

const PURPOSE = 'PASSWORD_RESET';

export async function latestOtpCreatedAt(userId: string): Promise<Date | undefined> {
  const [row] = await db
    .select({ createdAt: otpVerifications.createdAt })
    .from(otpVerifications)
    .where(and(eq(otpVerifications.userId, userId), eq(otpVerifications.purpose, PURPOSE)))
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);
  return row?.createdAt;
}

export async function countOtpsSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.userId, userId),
        eq(otpVerifications.purpose, PURPOSE),
        gt(otpVerifications.createdAt, since),
      ),
    );
  return row?.total ?? 0;
}

/** Closes every still-open OTP/reset for the user so only the newest one can be used. */
export async function invalidateOpenOtps(userId: string, now: Date, dbx: DbExecutor = db) {
  await dbx
    .update(otpVerifications)
    .set({ consumedAt: now })
    .where(and(eq(otpVerifications.userId, userId), isNull(otpVerifications.consumedAt)));
}

export async function deleteOtpsBefore(userId: string, before: Date, dbx: DbExecutor = db) {
  await dbx
    .delete(otpVerifications)
    .where(and(eq(otpVerifications.userId, userId), lt(otpVerifications.createdAt, before)));
}

export async function insertOtp(
  values: { userId: string; channel: OtpChannel; otpHash: string; expiresAt: Date },
  dbx: DbExecutor,
): Promise<void> {
  await dbx.insert(otpVerifications).values({ ...values, purpose: PURPOSE });
}

/** The newest OTP for this user and channel that could still be verified. */
export async function findOpenOtp(
  userId: string,
  channel: OtpChannel,
  now: Date,
): Promise<OtpVerification | undefined> {
  const [row] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.userId, userId),
        eq(otpVerifications.purpose, PURPOSE),
        eq(otpVerifications.channel, channel),
        isNull(otpVerifications.consumedAt),
        isNull(otpVerifications.verifiedAt),
        gt(otpVerifications.expiresAt, now),
      ),
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);
  return row;
}

/**
 * Atomically uses up one attempt, but only while attempts remain and the OTP is still open.
 * Spending the attempt *before* comparing means parallel guesses cannot exceed the limit.
 */
export async function spendOtpAttempt(id: string, maxAttempts: number, now: Date) {
  const [row] = await db
    .update(otpVerifications)
    .set({ attemptCount: sql`${otpVerifications.attemptCount} + 1` })
    .where(
      and(
        eq(otpVerifications.id, id),
        lt(otpVerifications.attemptCount, maxAttempts),
        isNull(otpVerifications.consumedAt),
        isNull(otpVerifications.verifiedAt),
        gt(otpVerifications.expiresAt, now),
      ),
    )
    .returning({ id: otpVerifications.id });
  return row !== undefined;
}

export async function markOtpVerified(
  id: string,
  resetTokenHash: string,
  resetTokenExpiresAt: Date,
  now: Date,
): Promise<boolean> {
  const updated = await db
    .update(otpVerifications)
    .set({ verifiedAt: now, resetTokenHash, resetTokenExpiresAt })
    .where(and(eq(otpVerifications.id, id), isNull(otpVerifications.verifiedAt)))
    .returning({ id: otpVerifications.id });
  return updated.length > 0;
}

/** Consumes a valid reset token exactly once; returns the owning user id, or undefined. */
export async function consumeResetToken(
  resetTokenHash: string,
  now: Date,
  dbx: DbExecutor,
): Promise<string | undefined> {
  const [row] = await dbx
    .update(otpVerifications)
    .set({ consumedAt: now })
    .where(
      and(
        eq(otpVerifications.resetTokenHash, resetTokenHash),
        isNotNull(otpVerifications.verifiedAt),
        isNull(otpVerifications.consumedAt),
        gt(otpVerifications.resetTokenExpiresAt, now),
      ),
    )
    .returning({ userId: otpVerifications.userId });
  return row?.userId;
}
