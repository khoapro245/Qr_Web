import { existsSync } from 'node:fs';
import { z } from 'zod';

// Local development reads backend/.env. Tests get their variables from vitest.config.ts, and
// in production the platform injects them directly.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string');

const secret = z.string().min(32, 'must be at least 32 characters');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    APP_ORIGIN: z.url().default('http://localhost:5173'),
    // Base of the link printed inside every QR code. Printed shirts cannot be updated, so in
    // production this must be a domain that will be kept for the lifetime of the shirts.
    PUBLIC_QR_BASE_URL: z.url().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    DATABASE_URL: postgresUrl,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_ACCESS_SECRET: secret,
    // Defaults to true in production. Only disable for plain-HTTP local testing.
    COOKIE_SECURE: z.stringbool().optional(),

    // Only local disk for now; an S3-compatible provider can be added behind the same interface.
    STORAGE_PROVIDER: z.enum(['local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().min(1).default('storage'),

    // Key for hashing one-time passwords (HMAC). Separate from the JWT secret.
    OTP_SECRET: secret,

    // "console" prints messages locally for development and is refused in production.
    EMAIL_PROVIDER: z.enum(['console', 'smtp', 'disabled']).default('console'),
    EMAIL_FROM: z.string().min(3).default('QR Care <no-reply@qrcare.local>'),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    // true = implicit TLS (usually port 465); false = STARTTLS upgrade (usually 587).
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    // No production SMS gateway has been chosen yet; see docs/architecture.md.
    SMS_PROVIDER: z.enum(['console', 'disabled']).default('console'),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_PROVIDER === 'smtp' && !value.SMTP_HOST) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'required for smtp' });
    }
    if (value.NODE_ENV !== 'production') return;
    for (const key of ['JWT_ACCESS_SECRET', 'OTP_SECRET'] as const) {
      if (/change-me/i.test(value[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'placeholder secret in production' });
      }
    }
    // Console providers write OTPs to the logs — never acceptable in production.
    if (value.EMAIL_PROVIDER === 'console') {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'console not allowed' });
    }
    if (value.SMS_PROVIDER === 'console') {
      ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'console not allowed' });
    }
    if (!value.PUBLIC_QR_BASE_URL?.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_QR_BASE_URL'],
        message: 'must be set to an https:// URL in production',
      });
    }
  })
  .transform((value) => ({
    ...value,
    COOKIE_SECURE: value.COOKIE_SECURE ?? value.NODE_ENV === 'production',
    PUBLIC_QR_BASE_URL: (value.PUBLIC_QR_BASE_URL ?? value.APP_ORIGIN).replace(/\/+$/, ''),
  }));

export type Env = z.output<typeof envSchema>;

/**
 * Validates a set of variables. Returns the parsed config, or the names (never the values —
 * they may be secrets) of the invalid variables.
 */
export function parseEnv(
  source: Record<string, string | undefined>,
): { ok: true; env: Env } | { ok: false; invalid: string[] } {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { ok: true, env: parsed.data };
  return {
    ok: false,
    invalid: [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))],
  };
}

function loadEnv(): Env {
  const result = parseEnv(process.env);
  if (!result.ok) {
    console.error(`Invalid environment configuration: ${result.invalid.join(', ')}`);
    process.exit(1);
  }
  return result.env;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
