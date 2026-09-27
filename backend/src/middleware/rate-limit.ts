import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

export interface RateLimiters {
  api: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  sensitive: RequestHandler;
  publicQr: RequestHandler;
}

const passThrough: RequestHandler = (_req, _res, next) => next();

function limiter(windowMs: number, limit: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      });
    },
  });
}

const MINUTE = 60 * 1000;

/**
 * Per-IP limits. Stores are in memory and created per app instance, which is correct for a
 * single API process; running several instances requires a shared store (e.g. Redis).
 * Per-account brute-force protection is handled separately by the login lockout.
 */
export function createRateLimiters(enabled: boolean): RateLimiters {
  if (!enabled) {
    return {
      api: passThrough,
      login: passThrough,
      refresh: passThrough,
      sensitive: passThrough,
      publicQr: passThrough,
    };
  }
  return {
    api: limiter(MINUTE, 300),
    login: limiter(15 * MINUTE, 20),
    refresh: limiter(15 * MINUTE, 120),
    sensitive: limiter(15 * MINUTE, 10),
    // A real scan costs two requests (profile + photo). Tokens are unguessable, so this
    // mainly stops scripted hammering; it stays generous for shared networks.
    publicQr: limiter(MINUTE, 60),
  };
}
