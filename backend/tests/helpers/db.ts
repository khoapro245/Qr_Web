import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import {
  customerProfiles,
  users,
  type NewCustomerProfile,
  type NewUser,
} from '../../src/db/schema.js';

export async function resetDatabase(): Promise<void> {
  await db.execute(sql`
    TRUNCATE audit_logs, otp_verifications, refresh_tokens, qr_codes, customer_profiles, users
    RESTART IDENTITY CASCADE
  `);
}

/** Postgres error code (e.g. 23505 unique_violation) from a raw or Drizzle-wrapped error. */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  while (current && typeof current === 'object') {
    if ('code' in current && typeof current.code === 'string') return current.code;
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

let counter = 0;

export async function insertUser(overrides: Partial<NewUser> = {}) {
  counter += 1;
  const [user] = await db
    .insert(users)
    .values({
      role: 'CUSTOMER',
      email: `user${counter}@example.com`,
      passwordHash: 'not-a-real-hash',
      ...overrides,
    })
    .returning();
  return user!;
}

export async function insertCustomerProfile(
  userId: string,
  overrides: Partial<NewCustomerProfile> = {},
) {
  const [profile] = await db
    .insert(customerProfiles)
    .values({
      userId,
      fullName: 'Nguyễn Văn A',
      dateOfBirth: '2006-03-19',
      gender: 'MALE',
      familyPhone: '+84912345678',
      ...overrides,
    })
    .returning();
  return profile!;
}
