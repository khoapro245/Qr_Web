import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customerProfiles, qrCodes, users } from '../db/schema.js';

/**
 * The profile behind a QR token, returned only when every condition for public display
 * holds: the code is ACTIVE, the account is an ACTIVE customer, and the customer consented
 * to public display. Any failing condition yields undefined — callers must not distinguish.
 */
export async function findPublicProfileByToken(token: string) {
  const [row] = await db
    .select({
      fullName: customerProfiles.fullName,
      dateOfBirth: customerProfiles.dateOfBirth,
      gender: customerProfiles.gender,
      address: customerProfiles.address,
      familyPhone: customerProfiles.familyPhone,
      bloodGroup: customerProfiles.bloodGroup,
      weightKg: customerProfiles.weightKg,
      heightCm: customerProfiles.heightCm,
      avatarKey: customerProfiles.avatarKey,
    })
    .from(qrCodes)
    .innerJoin(users, eq(users.id, qrCodes.userId))
    .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(
      and(
        eq(qrCodes.token, token),
        eq(qrCodes.status, 'ACTIVE'),
        eq(users.role, 'CUSTOMER'),
        eq(users.status, 'ACTIVE'),
        isNotNull(customerProfiles.publicConsentAt),
      ),
    );
  return row;
}
