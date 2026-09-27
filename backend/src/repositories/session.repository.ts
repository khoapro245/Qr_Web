import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client.js';
import { refreshTokens, users, type RefreshToken } from '../db/schema.js';

export async function createRefreshToken(
  values: { userId: string; familyId: string; tokenHash: string; expiresAt: Date },
  dbx: DbExecutor = db,
): Promise<RefreshToken> {
  const [row] = await dbx.insert(refreshTokens).values(values).returning();
  if (!row) throw new Error('Failed to create refresh token');
  return row;
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  return row;
}

/**
 * Marks a token as rotated. Returns false if it was already revoked, which means a concurrent
 * request rotated it first; the caller must then abort its own rotation.
 */
export async function markRefreshTokenRotated(
  id: string,
  replacedById: string,
  now: Date,
  dbx: DbExecutor = db,
): Promise<boolean> {
  const updated = await dbx
    .update(refreshTokens)
    .set({ revokedAt: now, replacedById })
    .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  return updated.length > 0;
}

export async function revokeSessionFamily(familyId: string, dbx: DbExecutor = db): Promise<void> {
  await dbx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllSessionsForUser(
  userId: string,
  dbx: DbExecutor = db,
): Promise<void> {
  await dbx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/**
 * Loads the user behind an access token, but only while its session is still alive (some
 * token in the family is unrevoked and unexpired). This makes logout, password changes and
 * deactivation take effect immediately instead of when the access token expires.
 */
export async function findUserWithLiveSession(userId: string, familyId: string, now: Date) {
  const [row] = await db
    .selectDistinct({
      id: users.id,
      role: users.role,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      passwordChangedAt: users.passwordChangedAt,
    })
    .from(users)
    .innerJoin(
      refreshTokens,
      and(
        eq(refreshTokens.userId, users.id),
        eq(refreshTokens.familyId, familyId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, now),
      ),
    )
    .where(eq(users.id, userId));
  return row;
}
