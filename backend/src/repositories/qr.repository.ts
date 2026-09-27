import { and, desc, eq } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client.js';
import { qrCodes, users, type QrCode } from '../db/schema.js';

/**
 * Serialises QR changes for one customer by locking their user row for the rest of the
 * transaction. Locking the active QR row is not enough: a waiting transaction would find
 * that row already revoked, see "no active code" and insert a second one.
 * Returns false if the customer does not exist.
 */
export async function lockCustomerForQrChange(userId: string, tx: DbExecutor): Promise<boolean> {
  const [row] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, 'CUSTOMER')))
    .for('update');
  return row !== undefined;
}

export async function findActiveQr(
  userId: string,
  dbx: DbExecutor = db,
): Promise<QrCode | undefined> {
  const [row] = await dbx
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.userId, userId), eq(qrCodes.status, 'ACTIVE')));
  return row;
}

export async function listQrCodes(userId: string): Promise<QrCode[]> {
  return db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.userId, userId))
    .orderBy(desc(qrCodes.createdAt), desc(qrCodes.id));
}

export async function insertQr(
  values: { userId: string; token: string; createdById: string | null },
  dbx: DbExecutor,
): Promise<QrCode> {
  const [row] = await dbx.insert(qrCodes).values(values).returning();
  if (!row) throw new Error('Failed to insert QR code');
  return row;
}

export async function revokeQrById(
  id: string,
  revokedById: string,
  now: Date,
  dbx: DbExecutor,
): Promise<void> {
  await dbx
    .update(qrCodes)
    .set({ status: 'REVOKED', revokedAt: now, revokedById })
    .where(and(eq(qrCodes.id, id), eq(qrCodes.status, 'ACTIVE')));
}
