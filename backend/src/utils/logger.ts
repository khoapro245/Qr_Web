import { pino } from 'pino';
import { env } from '../config/env.js';
import { serializeError } from './safe-error.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  serializers: { err: serializeError },
  // Defence in depth: even if a sensitive object is logged by mistake, these keys are masked.
  redact: {
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'otp',
      '*.otp',
      'token',
      '*.token',
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
  }),
});

/**
 * Strips the query string and masks public QR tokens so request logs never contain
 * a working QR link (anyone holding it could view the owner's profile).
 */
export function redactUrl(url: string): string {
  const path = url.split('?')[0] ?? '';
  return path.replace(/(\/qr\/)[^/]+/g, '$1[redacted]');
}
