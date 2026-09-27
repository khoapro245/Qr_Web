import type { CookieOptions, Request, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, COOKIE_NAMES, REFRESH_TOKEN_TTL_MS } from '../config/auth.js';
import { env } from '../config/env.js';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict',
};

const accessOptions: CookieOptions = { ...baseOptions, path: '/api' };
// Scoped to the auth endpoints so the long-lived token is not sent with every request.
const refreshOptions: CookieOptions = { ...baseOptions, path: '/api/auth' };

/** Reads a cookie as a non-empty string; anything else (missing, array, object) is ignored. */
export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function setSessionCookies(res: Response, tokens: SessionTokens): void {
  res.cookie(COOKIE_NAMES.access, tokens.accessToken, {
    ...accessOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE_NAMES.refresh, tokens.refreshToken, {
    ...refreshOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.access, accessOptions);
  res.clearCookie(COOKIE_NAMES.refresh, refreshOptions);
}

/** The CSRF cookie is readable by the SPA, which echoes it in the X-CSRF-Token header. */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAMES.csrf, token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
  });
}
