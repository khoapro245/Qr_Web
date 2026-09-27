import { eq, sql } from 'drizzle-orm';
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGINS } from '../config/auth.js';
import { db, type DbExecutor } from '../db/client.js';
import { customerProfiles, users, type User } from '../db/schema.js';

export async function findUserById(id: string, dbx: DbExecutor = db): Promise<User | undefined> {
  const [user] = await dbx.select().from(users).where(eq(users.id, id));
  return user;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  return user;
}

/** Name shown in the app header: the customer's full name, or the account email/phone. */
export async function findDisplayName(user: User): Promise<string> {
  if (user.role === 'CUSTOMER') {
    const [profile] = await db
      .select({ fullName: customerProfiles.fullName })
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, user.id));
    if (profile) return profile.fullName;
  }
  return user.email ?? user.phone ?? '';
}

/**
 * Atomically counts a failed login. On reaching the limit the account is locked for a while
 * and the counter restarts, so each lockout needs a fresh series of failures.
 */
export async function registerFailedLogin(id: string, now: Date): Promise<void> {
  const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
  await db
    .update(users)
    .set({
      failedLoginCount: sql`CASE WHEN ${users.failedLoginCount} + 1 >= ${MAX_FAILED_LOGINS}
        THEN 0 ELSE ${users.failedLoginCount} + 1 END`,
      lockedUntil: sql`CASE WHEN ${users.failedLoginCount} + 1 >= ${MAX_FAILED_LOGINS}
        THEN ${lockUntil.toISOString()}::timestamptz ELSE ${users.lockedUntil} END`,
    })
    .where(eq(users.id, id));
}

export async function recordSuccessfulLogin(id: string, now: Date): Promise<void> {
  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(users.id, id));
}

export async function updatePassword(
  id: string,
  passwordHash: string,
  options: { mustChangePassword: boolean; now: Date },
  dbx: DbExecutor = db,
): Promise<void> {
  await dbx
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: options.mustChangePassword,
      passwordChangedAt: options.now,
      failedLoginCount: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, id));
}
