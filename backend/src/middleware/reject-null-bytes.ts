import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

const MAX_DEPTH = 20;

function containsNullByte(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return false;
  return Object.entries(value).some(
    ([key, nested]) => key.includes('\u0000') || containsNullByte(nested, depth + 1),
  );
}

/**
 * PostgreSQL text cannot store the NUL character; letting one through turns an ordinary bad
 * input into a database error. No legitimate field in this app needs it, so reject early.
 */
export const rejectNullBytes: RequestHandler = (req, _res, next) => {
  if (containsNullByte(req.body) || containsNullByte(req.query)) {
    throw new AppError(400, 'INVALID_INPUT', 'Input contains invalid characters');
  }
  next();
};
