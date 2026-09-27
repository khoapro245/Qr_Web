import type { ValidationIssue } from '@qrcare/shared';
import type { z } from 'zod';
import { AppError } from '../utils/app-error.js';

/** Parses untrusted input with a zod schema or throws a 400 with per-field messages. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details);
  }
  return result.data;
}
