import type { DashboardStats } from '@qrcare/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { qrCodes, users } from '../db/schema.js';

export async function getDashboardStats(): Promise<DashboardStats> {
  const [[customers], [qr]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`(count(*) FILTER (WHERE ${users.status} = 'ACTIVE'))::int`,
        inactive: sql<number>`(count(*) FILTER (WHERE ${users.status} = 'INACTIVE'))::int`,
      })
      .from(users)
      .where(eq(users.role, 'CUSTOMER')),
    db
      .select({
        active: sql<number>`(count(*) FILTER (WHERE ${qrCodes.status} = 'ACTIVE'))::int`,
        revoked: sql<number>`(count(*) FILTER (WHERE ${qrCodes.status} = 'REVOKED'))::int`,
      })
      .from(qrCodes),
  ]);

  return {
    totalCustomers: customers?.total ?? 0,
    activeCustomers: customers?.active ?? 0,
    inactiveCustomers: customers?.inactive ?? 0,
    activeQrCodes: qr?.active ?? 0,
    revokedQrCodes: qr?.revoked ?? 0,
  };
}
