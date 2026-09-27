import { db, type DbExecutor } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export type AuditAction =
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_STATUS_CHANGED'
  | 'CUSTOMER_PASSWORD_RESET'
  | 'CUSTOMER_AVATAR_UPDATED'
  | 'CUSTOMER_AVATAR_REMOVED'
  | 'QR_GENERATED'
  | 'QR_REGENERATED'
  | 'QR_REVOKED'
  | 'PROFILE_UPDATED_BY_OWNER';

/**
 * Records who did what to whom. `metadata` must contain only non-personal values such as
 * changed field *names* or status transitions — never the values themselves, credentials,
 * OTPs or QR tokens, so the audit log cannot become a second copy of personal data.
 */
export async function recordAudit(
  entry: {
    actorUserId: string | null;
    action: AuditAction;
    targetUserId?: string | null;
    metadata?: Record<string, string | number | boolean | string[] | null>;
  },
  dbx: DbExecutor = db,
): Promise<void> {
  await dbx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    metadata: entry.metadata ?? null,
  });
}

/** Names of the keys whose values differ between two snapshots. */
export function changedFields<T extends object>(before: T, after: Partial<T>): string[] {
  return (Object.keys(after) as (keyof T)[])
    .filter((key) => after[key] !== undefined && after[key] !== before[key])
    .map(String);
}
