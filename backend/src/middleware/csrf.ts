import type { RequestHandler } from 'express';
import { COOKIE_NAMES, CSRF_HEADER } from '../config/auth.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { readCookie } from '../utils/cookies.js';
import { safeEqual } from '../utils/crypto.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Checks whether the incoming Origin is allowed. In development, local network IP addresses
 * (such as 192.168.x.x, 10.x.x.x, localhost) are permitted so developers can test from mobile devices.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === env.APP_ORIGIN) return true;
  if (env.NODE_ENV === 'development') {
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * CSRF defence for cookie-authenticated requests, layered on top of SameSite=Strict cookies:
 * 1. A present Origin header must match the app's own origin.
 * 2. Double-submit token: the X-CSRF-Token header must equal the qrc_csrf cookie. Another
 *    site can make the browser send the cookie but cannot read it to set the header.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    throw new AppError(403, 'CSRF_ORIGIN_MISMATCH', 'Cross-origin request blocked');
  }

  const cookieToken = readCookie(req, COOKIE_NAMES.csrf);
  const headerToken = req.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new AppError(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
  }
  next();
};
