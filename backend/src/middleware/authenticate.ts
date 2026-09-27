import type { UserRole } from '@qrcare/shared';
import type { Request, RequestHandler } from 'express';
import { COOKIE_NAMES } from '../config/auth.js';
import { findUserWithLiveSession } from '../repositories/session.repository.js';
import { verifyAccessToken } from '../services/token.service.js';
import type { AuthContext } from '../types/express.js';
import { AppError } from '../utils/app-error.js';
import { clearSessionCookies, readCookie } from '../utils/cookies.js';

const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

/**
 * Verifies the access-token cookie and re-checks the account in the database on every
 * request, so deactivation, logout and password changes apply immediately.
 */
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = readCookie(req, COOKIE_NAMES.access);
  if (!token) throw unauthenticated();

  const claims = await verifyAccessToken(token);
  if (!claims) throw unauthenticated();

  const user = await findUserWithLiveSession(claims.userId, claims.sessionId, new Date());
  if (!user) throw unauthenticated();

  // Tokens minted before the latest password change are no longer valid.
  if (claims.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw unauthenticated();
  }

  if (user.status !== 'ACTIVE') {
    clearSessionCookies(res);
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'This account is inactive');
  }

  req.auth = {
    userId: user.id,
    // Role comes from the database, not the token, so a role change cannot be outlived.
    role: user.role,
    sessionId: claims.sessionId,
    mustChangePassword: user.mustChangePassword,
  };
  next();
};

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}

/** Blocks everything except the password-change flow until a default password is replaced. */
export const requirePasswordChanged: RequestHandler = (req, _res, next) => {
  if (getAuth(req).mustChangePassword) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your password first');
  }
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(getAuth(req).role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource');
    }
    next();
  };
}
