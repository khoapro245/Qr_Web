import type { CustomerDetail } from '@qrcare/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customerProfiles } from '../db/schema.js';
import { storage, type StoredObject } from '../providers/storage/index.js';
import { findCustomerById } from '../repositories/customer.repository.js';
import { AppError } from '../utils/app-error.js';
import { randomToken } from '../utils/crypto.js';
import { processAvatarImage } from '../utils/image.js';
import { logger } from '../utils/logger.js';
import { recordAudit } from './audit.service.js';
import { getCustomerForAdmin } from './customer.service.js';

const customerNotFound = () => new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

/** Best effort: a leftover file is harmless, a failed request because of it is not. */
async function deleteQuietly(key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch (err) {
    logger.warn({ err }, 'Failed to delete stored avatar');
  }
}

/**
 * Stores a new avatar for a customer (admin only). The new file is written first and the old
 * one removed only after the database points at the new key, so a failure never leaves the
 * profile referencing a missing image.
 */
export async function setCustomerAvatar(
  adminId: string,
  customerId: string,
  upload: Buffer,
): Promise<CustomerDetail> {
  if (!(await findCustomerById(customerId))) throw customerNotFound();

  const image = await processAvatarImage(upload);
  const key = `avatars/${randomToken(18)}.webp`;
  await storage.put(key, image, 'image/webp');

  let previousKey: string | null;
  try {
    previousKey = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ avatarKey: customerProfiles.avatarKey })
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, customerId))
        .for('update');
      if (!current) throw customerNotFound();
      await tx
        .update(customerProfiles)
        .set({ avatarKey: key })
        .where(eq(customerProfiles.userId, customerId));
      await recordAudit(
        {
          actorUserId: adminId,
          action: 'CUSTOMER_AVATAR_UPDATED',
          targetUserId: customerId,
          metadata: { replaced: current.avatarKey !== null },
        },
        tx,
      );
      return current.avatarKey;
    });
  } catch (err) {
    await deleteQuietly(key);
    throw err;
  }

  if (previousKey) await deleteQuietly(previousKey);
  return getCustomerForAdmin(customerId);
}

export async function removeCustomerAvatar(
  adminId: string,
  customerId: string,
): Promise<CustomerDetail> {
  const record = await findCustomerById(customerId);
  if (!record) throw customerNotFound();
  const key = record.profile.avatarKey;
  if (key) {
    await db.transaction(async (tx) => {
      await tx
        .update(customerProfiles)
        .set({ avatarKey: null })
        .where(eq(customerProfiles.userId, customerId));
      await recordAudit(
        { actorUserId: adminId, action: 'CUSTOMER_AVATAR_REMOVED', targetUserId: customerId },
        tx,
      );
    });
    await deleteQuietly(key);
  }
  return getCustomerForAdmin(customerId);
}

/** Loads a customer's avatar image; 404 when the customer or the avatar does not exist. */
export async function loadCustomerAvatar(customerId: string): Promise<StoredObject> {
  const record = await findCustomerById(customerId);
  const key = record?.profile.avatarKey;
  const image = key ? await storage.get(key) : null;
  if (!image) throw new AppError(404, 'AVATAR_NOT_FOUND', 'Avatar not found');
  return image;
}
