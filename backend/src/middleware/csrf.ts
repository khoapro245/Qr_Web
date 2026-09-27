import type { RequestHandler } from 'express';
import { COOKIE_NAMES, CSRF_HEADER } from '../config/auth.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { readCookie } from '../utils/cookies.js';
import { safeEqual } from '../utils/crypto.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests, layered on top of SameSite=Strict cookies:
 * 1. A present Origin header must match the app's own origin.
 * 2. Double-submit token: the X-CSRF-Token header must equal the qrc_csrf cookie. Another
 *    site can make the browser send the cookie but cannot read it to set the header.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && origin !== env.APP_ORIGIN) {
    throw new AppError(403, 'CSRF_ORIGIN_MISMATCH', 'Cross-origin request blocked');
  }

  const cookieToken = readCookie(req, COOKIE_NAMES.csrf);
  const headerToken = req.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new AppError(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
  }
  next();
};
