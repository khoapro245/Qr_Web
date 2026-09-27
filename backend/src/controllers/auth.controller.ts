import { changePasswordSchema, loginSchema } from '@qrcare/shared';
import type { Request, Response } from 'express';
import { COOKIE_NAMES } from '../config/auth.js';
import { getAuth } from '../middleware/authenticate.js';
import { parseInput } from '../middleware/validate.js';
import * as authService from '../services/auth.service.js';
import { AppError } from '../utils/app-error.js';
import {
  clearSessionCookies,
  readCookie,
  setCsrfCookie,
  setSessionCookies,
} from '../utils/cookies.js';
import { randomToken } from '../utils/crypto.js';

const CSRF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function getCsrfToken(req: Request, res: Response) {
  let token = readCookie(req, COOKIE_NAMES.csrf);
  if (!token || !CSRF_TOKEN_PATTERN.test(token)) {
    token = randomToken(32);
    setCsrfCookie(res, token);
  }
  res.json({ success: true, data: { csrfToken: token } });
}

export async function login(req: Request, res: Response) {
  const input = parseInput(loginSchema, req.body);
  const { user, tokens } = await authService.login(input);
  setSessionCookies(res, tokens);
  // Fresh CSRF token for the new session.
  setCsrfCookie(res, randomToken(32));
  res.json({ success: true, data: { user } });
}

export async function refresh(req: Request, res: Response) {
  try {
    const tokens = await authService.refreshSession(readCookie(req, COOKIE_NAMES.refresh));
    setSessionCookies(res, tokens);
    res.json({ success: true, data: null });
  } catch (err) {
    if (err instanceof AppError && err.status === 401) clearSessionCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(readCookie(req, COOKIE_NAMES.refresh));
  clearSessionCookies(res);
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getCurrentUser(getAuth(req).userId);
  res.json({ success: true, data: { user } });
}

export async function changePassword(req: Request, res: Response) {
  const input = parseInput(changePasswordSchema, req.body);
  const { user, tokens } = await authService.changePassword(getAuth(req).userId, input);
  setSessionCookies(res, tokens);
  res.json({ success: true, data: { user } });
}
