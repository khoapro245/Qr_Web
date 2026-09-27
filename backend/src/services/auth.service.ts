import type { AuthUser, ChangePasswordInput, LoginInput } from '@qrcare/shared';
import { randomUUID } from 'node:crypto';
import { REFRESH_REUSE_GRACE_MS, REFRESH_TOKEN_TTL_MS } from '../config/auth.js';
import { db, type DbExecutor } from '../db/client.js';
import type { User } from '../db/schema.js';
import {
  createRefreshToken,
  findRefreshTokenByHash,
  markRefreshTokenRotated,
  revokeAllSessionsForUser,
  revokeSessionFamily,
} from '../repositories/session.repository.js';
import {
  findDisplayName,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  recordSuccessfulLogin,
  registerFailedLogin,
  updatePassword,
} from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import type { SessionTokens } from '../utils/cookies.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken } from './token.service.js';

// Same response for "no such account" and "wrong password" so logins cannot be used to
// discover which emails / phone numbers are registered.
const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password');
const sessionExpired = () => new AppError(401, 'SESSION_EXPIRED', 'Session expired');

let dummyHash: Promise<string> | undefined;
/** Hash used to spend the same time verifying a password when the account does not exist. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomToken());
  return dummyHash;
}

export async function toAuthUser(user: User): Promise<AuthUser> {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone,
    displayName: await findDisplayName(user),
    mustChangePassword: user.mustChangePassword,
  };
}

async function issueSession(
  user: Pick<User, 'id' | 'role'>,
  familyId: string = randomUUID(),
  dbx: DbExecutor = db,
): Promise<SessionTokens & { refreshTokenId: string }> {
  const refreshToken = randomToken(32);
  const row = await createRefreshToken(
    {
      userId: user.id,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
    dbx,
  );
  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    sessionId: familyId,
  });
  return { accessToken, refreshToken, refreshTokenId: row.id };
}

export async function login(input: LoginInput): Promise<{ user: AuthUser; tokens: SessionTokens }> {
  const { type, value } = input.identifier;
  const user = type === 'email' ? await findUserByEmail(value) : await findUserByPhone(value);

  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    throw invalidCredentials();
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
    throw new AppError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts, try again later', {
      retryAfterSeconds,
    });
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    await registerFailedLogin(user.id, now);
    logger.warn({ userId: user.id }, 'auth.login.failed');
    throw invalidCredentials();
  }

  // Checked only after the password, so inactive status is not revealed to guessers.
  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account is inactive');
  }

  await recordSuccessfulLogin(user.id, now);
  const tokens = await issueSession(user);
  logger.info({ userId: user.id, role: user.role }, 'auth.login.success');
  return { user: await toAuthUser(user), tokens };
}

export async function refreshSession(rawToken: string | undefined): Promise<SessionTokens> {
  if (!rawToken) throw sessionExpired();

  const stored = await findRefreshTokenByHash(sha256(rawToken));
  if (!stored) throw sessionExpired();

  const now = new Date();
  if (stored.revokedAt) {
    const rotatedRecently =
      stored.replacedById !== null &&
      now.getTime() - stored.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
    if (rotatedRecently) {
      throw new AppError(409, 'REFRESH_CONFLICT', 'Session was refreshed concurrently, retry');
    }
    // A rotated token presented again long after rotation: likely stolen. End the session.
    await revokeSessionFamily(stored.familyId);
    logger.warn({ userId: stored.userId }, 'auth.refresh.reuse_detected');
    throw sessionExpired();
  }

  if (stored.expiresAt <= now) throw sessionExpired();

  const user = await findUserById(stored.userId);
  if (!user || user.status !== 'ACTIVE') {
    await revokeAllSessionsForUser(stored.userId);
    throw sessionExpired();
  }

  return db.transaction(async (tx) => {
    const next = await issueSession(user, stored.familyId, tx);
    const rotated = await markRefreshTokenRotated(stored.id, next.refreshTokenId, now, tx);
    if (!rotated) {
      // Lost a race with a concurrent refresh; throwing rolls back the token we just made.
      throw new AppError(409, 'REFRESH_CONFLICT', 'Session was refreshed concurrently, retry');
    }
    return { accessToken: next.accessToken, refreshToken: next.refreshToken };
  });
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const stored = await findRefreshTokenByHash(sha256(rawRefreshToken));
  if (stored) await revokeSessionFamily(stored.familyId);
}

export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await findUserById(userId);
  if (!user) throw sessionExpired();
  return toAuthUser(user);
}

/**
 * Changes the password, ends every other session of this user and returns a fresh session
 * for the current client so it stays signed in.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ user: AuthUser; tokens: SessionTokens }> {
  const user = await findUserById(userId);
  if (!user) throw sessionExpired();

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();
  const tokens = await db.transaction(async (tx) => {
    await updatePassword(user.id, passwordHash, { mustChangePassword: false, now }, tx);
    await revokeAllSessionsForUser(user.id, tx);
    return issueSession(user, randomUUID(), tx);
  });

  logger.info({ userId: user.id }, 'auth.password.changed');
  const updated = { ...user, mustChangePassword: false };
  return {
    user: await toAuthUser(updated),
    tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
  };
}
