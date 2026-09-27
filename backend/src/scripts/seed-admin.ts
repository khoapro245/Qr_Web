// Creates the first admin account, or resets an existing admin's password.
//
//   npm run db:seed-admin -- admin@example.com            create admin
//   npm run db:seed-admin -- admin@example.com --reset    reset that admin's password
//
// The password comes from ADMIN_PASSWORD if set, otherwise a random one is generated and
// printed exactly once. Either way the admin must change it on first login.
import { eq } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { db, pool } from '../db/client.js';
import { users } from '../db/schema.js';
import { generateTemporaryPassword, hashPassword } from '../utils/password.js';

const MIN_ADMIN_PASSWORD_LENGTH = 12;

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { reset: { type: 'boolean', default: false } },
  });

  const email = z.email().safeParse(positionals[0]?.trim().toLowerCase());
  if (!email.success) {
    console.error('Usage: npm run db:seed-admin -- <admin-email> [--reset]');
    return 1;
  }

  const providedPassword = process.env.ADMIN_PASSWORD;
  if (providedPassword !== undefined && providedPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    console.error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
    return 1;
  }
  const password = providedPassword ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const [existing] = await db.select().from(users).where(eq(users.email, email.data));

  if (existing && existing.role !== 'ADMIN') {
    console.error('This email belongs to a non-admin account. Aborting.');
    return 1;
  }

  if (existing && !values.reset) {
    console.error('An admin with this email already exists. Use --reset to reset its password.');
    return 1;
  }

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`Password reset for admin ${email.data}.`);
  } else {
    await db.insert(users).values({
      role: 'ADMIN',
      email: email.data,
      passwordHash,
      mustChangePassword: true,
    });
    console.log(`Admin ${email.data} created.`);
  }

  if (providedPassword === undefined) {
    console.log(`Temporary password (shown once): ${password}`);
  }
  console.log('The admin must change this password on first login.');
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error('Failed to seed admin:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
