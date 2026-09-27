import {
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  type LoginIdentifier,
  type OtpChannel,
  type ResetPasswordInput,
} from '@qrcare/shared';
import { createHmac, randomInt } from 'node:crypto';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { emailProvider } from '../providers/email/index.js';
import { smsProvider } from '../providers/sms/index.js';
import {
  consumeResetToken,
  countOtpsSince,
  deleteOtpsBefore,
  findOpenOtp,
  insertOtp,
  invalidateOpenOtps,
  latestOtpCreatedAt,
  markOtpVerified,
  spendOtpAttempt,
} from '../repositories/otp.repository.js';
import { revokeAllSessionsForUser } from '../repositories/session.repository.js';
import {
  findUserByEmail,
  findUserById,
  findUserByPhone,
  updatePassword,
} from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { randomToken, safeEqual, sha256 } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { recordAudit } from './audit.service.js';

const MAX_OTP_ATTEMPTS = 5;
const MAX_OTPS_PER_HOUR = 5;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const OTP_RETENTION_MS = 24 * 60 * 60 * 1000;

const otpInvalid = () => new AppError(400, 'OTP_INVALID', 'The code is incorrect or has expired');

/**
 * OTPs are stored as an HMAC keyed with a server secret and bound to the user id. A plain
 * hash of a 6-digit code could be reversed by trying all million codes; without the key a
 * leaked table is useless.
 */
function hashOtp(userId: string, code: string): string {
  return createHmac('sha256', env.OTP_SECRET).update(`${userId}:${code}`).digest('hex');
}

function generateOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

function channelFor(identifier: LoginIdentifier): OtpChannel {
  return identifier.type === 'email' ? 'EMAIL' : 'SMS';
}

/** Only active customers recover passwords this way; admins use the CLI reset. */
async function findEligibleUser(identifier: LoginIdentifier): Promise<User | undefined> {
  const user =
    identifier.type === 'email'
      ? await findUserByEmail(identifier.value)
      : await findUserByPhone(identifier.value);
  return user && user.role === 'CUSTOMER' && user.status === 'ACTIVE' ? user : undefined;
}

function assertChannelAvailable(channel: OtpChannel): void {
  const available = channel === 'EMAIL' ? emailProvider.enabled : smsProvider.enabled;
  if (!available) {
    // A configuration fact, identical for every account, so it reveals nothing about users.
    throw new AppError(
      503,
      channel === 'EMAIL' ? 'EMAIL_UNAVAILABLE' : 'SMS_UNAVAILABLE',
      'This recovery channel is not available',
    );
  }
}

async function deliver(channel: OtpChannel, to: string, code: string): Promise<void> {
  if (channel === 'EMAIL') {
    await emailProvider.send({
      to,
      subject: 'Mã khôi phục mật khẩu QR Care',
      text:
        `Mã xác nhận của bạn là ${code}.\n\n` +
        `Mã có hiệu lực trong ${OTP_TTL_MINUTES} phút và chỉ dùng được một lần. ` +
        'Không chia sẻ mã này cho bất kỳ ai.\n\n' +
        'Nếu bạn không yêu cầu khôi phục mật khẩu, hãy bỏ qua email này.',
    });
  } else {
    // Unaccented text fits one SMS segment and displays on every handset.
    await smsProvider.send(
      to,
      `QR Care: Ma xac nhan cua ban la ${code}, hieu luc ${OTP_TTL_MINUTES} phut. Khong chia se ma nay.`,
    );
  }
}

/**
 * Step 1. Always completes the same way whether or not the account exists, so the endpoint
 * cannot be used to discover registered emails or phone numbers. Delivery runs in the
 * background so response time does not reveal it either.
 */
export async function requestPasswordReset(identifier: LoginIdentifier): Promise<void> {
  const channel = channelFor(identifier);
  assertChannelAvailable(channel);

  const user = await findEligibleUser(identifier);
  if (!user) return;

  const now = new Date();
  const latest = await latestOtpCreatedAt(user.id);
  if (latest && now.getTime() - latest.getTime() < OTP_RESEND_SECONDS * 1000) return;
  if (
    (await countOtpsSince(user.id, new Date(now.getTime() - 60 * 60 * 1000))) >= MAX_OTPS_PER_HOUR
  ) {
    logger.warn({ userId: user.id }, 'auth.password_reset.hourly_limit');
    return;
  }

  const code = generateOtp();
  await db.transaction(async (tx) => {
    await deleteOtpsBefore(user.id, new Date(now.getTime() - OTP_RETENTION_MS), tx);
    await invalidateOpenOtps(user.id, now, tx);
    await insertOtp(
      {
        userId: user.id,
        channel,
        otpHash: hashOtp(user.id, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000),
      },
      tx,
    );
  });

  logger.info({ userId: user.id, channel }, 'auth.password_reset.requested');
  void deliver(channel, identifier.value, code).catch((err: unknown) => {
    logger.error({ err, userId: user.id, channel }, 'auth.password_reset.delivery_failed');
  });
}

/** Step 2. A correct code is exchanged for a short-lived, single-use reset token. */
export async function verifyResetOtp(
  identifier: LoginIdentifier,
  code: string,
): Promise<{ resetToken: string }> {
  const user = await findEligibleUser(identifier);
  const now = new Date();
  const otp = user ? await findOpenOtp(user.id, channelFor(identifier), now) : undefined;
  if (!user || !otp) throw otpInvalid();

  if (!(await spendOtpAttempt(otp.id, MAX_OTP_ATTEMPTS, now))) throw otpInvalid();
  if (!safeEqual(otp.otpHash, hashOtp(user.id, code))) {
    logger.warn({ userId: user.id }, 'auth.password_reset.otp_mismatch');
    throw otpInvalid();
  }

  const resetToken = randomToken(32);
  const verified = await markOtpVerified(
    otp.id,
    sha256(resetToken),
    new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    now,
  );
  if (!verified) throw otpInvalid();
  return { resetToken };
}

/** Step 3. Sets the new password, ends every session and closes all other open codes. */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  await db.transaction(async (tx) => {
    const userId = await consumeResetToken(sha256(input.resetToken), now, tx);
    const user = userId ? await findUserById(userId, tx) : undefined;
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(400, 'RESET_TOKEN_INVALID', 'The reset session is invalid or has expired');
    }
    await updatePassword(user.id, passwordHash, { mustChangePassword: false, now }, tx);
    await revokeAllSessionsForUser(user.id, tx);
    await invalidateOpenOtps(user.id, now, tx);
    await recordAudit(
      { actorUserId: user.id, action: 'PASSWORD_RESET_BY_OTP', targetUserId: user.id },
      tx,
    );
  });
}
