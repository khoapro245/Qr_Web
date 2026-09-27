import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/app-error.js';

const uuid = z.uuid();

/** The `:id` route parameter; a malformed id is "not found", never a database error. */
export function customerId(req: Request): string {
  const parsed = uuid.safeParse(req.params.id);
  if (!parsed.success) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  return parsed.data;
}
