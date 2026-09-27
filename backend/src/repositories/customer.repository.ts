import type { ListCustomersQuery } from '@qrcare/shared';
import { and, count, desc, eq, exists, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client.js';
import {
  customerProfiles,
  qrCodes,
  users,
  type CustomerProfile,
  type NewCustomerProfile,
  type NewUser,
  type User,
} from '../db/schema.js';

export interface CustomerRecord {
  user: User;
  profile: CustomerProfile;
}

const hasActiveQr = exists(
  db
    .select({ one: sql`1` })
    .from(qrCodes)
    .where(and(eq(qrCodes.userId, users.id), eq(qrCodes.status, 'ACTIVE'))),
);

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Matches name (accent-insensitive), email, or phone. A phone typed in local form
 * ("0912 345") is converted to the stored E.164 prefix ("+84912345").
 */
function searchCondition(search: string): SQL | undefined {
  const pattern = `%${escapeLike(search)}%`;
  const conditions: (SQL | undefined)[] = [
    sql`unaccent(${customerProfiles.fullName}) ILIKE unaccent(${pattern})`,
    ilike(users.email, pattern),
  ];

  const digits = search.replace(/[\s.\-()]/g, '');
  if (/^\+?\d{3,}$/.test(digits)) {
    const phonePart = digits.startsWith('0') ? `+84${digits.slice(1)}` : digits;
    conditions.push(ilike(users.phone, `%${escapeLike(phonePart)}%`));
  }
  return or(...conditions);
}

export async function listCustomers(query: ListCustomersQuery) {
  const where = and(
    eq(users.role, 'CUSTOMER'),
    query.status ? eq(users.status, query.status) : undefined,
    query.search ? searchCondition(query.search) : undefined,
  );

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        status: users.status,
        createdAt: users.createdAt,
        fullName: customerProfiles.fullName,
        dateOfBirth: customerProfiles.dateOfBirth,
        hasActiveQr: sql<boolean>`${hasActiveQr}`,
      })
      .from(users)
      .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(users)
      .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
      .where(where),
  ]);

  return { rows, total: totals?.total ?? 0 };
}

export type CustomerListRow = Awaited<ReturnType<typeof listCustomers>>['rows'][number];

export async function findCustomerById(
  id: string,
  dbx: DbExecutor = db,
): Promise<CustomerRecord | undefined> {
  const [row] = await dbx
    .select({ user: users, profile: customerProfiles })
    .from(users)
    .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(and(eq(users.id, id), eq(users.role, 'CUSTOMER')));
  return row;
}

export async function insertCustomer(
  user: Omit<NewUser, 'role'>,
  profile: Omit<NewCustomerProfile, 'userId'>,
  dbx: DbExecutor,
): Promise<CustomerRecord> {
  const [createdUser] = await dbx
    .insert(users)
    .values({ ...user, role: 'CUSTOMER' })
    .returning();
  if (!createdUser) throw new Error('Failed to insert customer user');
  const [createdProfile] = await dbx
    .insert(customerProfiles)
    .values({ ...profile, userId: createdUser.id })
    .returning();
  if (!createdProfile) throw new Error('Failed to insert customer profile');
  return { user: createdUser, profile: createdProfile };
}

export async function updateCustomerUser(
  id: string,
  values: Partial<Pick<NewUser, 'email' | 'phone' | 'status'>>,
  dbx: DbExecutor = db,
): Promise<void> {
  await dbx.update(users).set(values).where(eq(users.id, id));
}

export async function updateCustomerProfile(
  userId: string,
  values: Partial<Omit<NewCustomerProfile, 'userId'>>,
  dbx: DbExecutor = db,
): Promise<void> {
  await dbx.update(customerProfiles).set(values).where(eq(customerProfiles.userId, userId));
}
