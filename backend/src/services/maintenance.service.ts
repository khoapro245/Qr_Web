import { lt, or, isNotNull, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { otpVerifications, refreshTokens } from '../db/schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Keep revoked tokens a little while: reuse of a recently rotated token is how theft is
// detected, so they must not disappear the moment they are revoked.
const REVOKED_TOKEN_RETENTION_MS = 30 * DAY_MS;
const OTP_RETENTION_MS = DAY_MS;

/**
 * Removes session and OTP rows that can never be used again. Every refresh (about every
 * 15 minutes per active session) adds a row, so without this the table grows forever.
 */
export async function purgeStaleAuthRecords(now = new Date()) {
  const expiredTokens = await db
    .delete(refreshTokens)
    .where(
      or(
        lt(refreshTokens.expiresAt, now),
        and(
          isNotNull(refreshTokens.revokedAt),
          lt(refreshTokens.revokedAt, new Date(now.getTime() - REVOKED_TOKEN_RETENTION_MS)),
        ),
      ),
    )
    .returning({ id: refreshTokens.id });

  const oldOtps = await db
    .delete(otpVerifications)
    .where(lt(otpVerifications.createdAt, new Date(now.getTime() - OTP_RETENTION_MS)))
    .returning({ id: otpVerifications.id });

  return { refreshTokens: expiredTokens.length, otps: oldOtps.length };
}
