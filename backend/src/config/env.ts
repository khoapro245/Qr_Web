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
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    DATABASE_URL: postgresUrl,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_ACCESS_SECRET: secret,
    // Defaults to true in production. Only disable for plain-HTTP local testing.
    COOKIE_SECURE: z.stringbool().optional(),

    // Only local disk for now; an S3-compatible provider can be added behind the same interface.
    STORAGE_PROVIDER: z.enum(['local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().min(1).default('storage'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && /change-me/i.test(value.JWT_ACCESS_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'placeholder secret used in production',
      });
    }
  })
  .transform((value) => ({
    ...value,
    COOKIE_SECURE: value.COOKIE_SECURE ?? value.NODE_ENV === 'production',
  }));

export type Env = z.output<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Report only variable names, never values: they may be secrets.
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    console.error(`Invalid environment configuration: ${names.join(', ')}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
