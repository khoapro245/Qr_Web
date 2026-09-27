import { calculateAge, QR_TOKEN_PATTERN, type PublicProfile } from '@qrcare/shared';
import { storage, type StoredObject } from '../providers/storage/index.js';
import { findPublicProfileByToken } from '../repositories/public.repository.js';
import { AppError } from '../utils/app-error.js';
import { sha256 } from '../utils/crypto.js';

// One response for unknown, malformed, revoked and deactivated alike, so a scanner learns
// nothing about which codes exist or why a code stopped working.
const unavailable = () =>
  new AppError(404, 'QR_NOT_FOUND', 'QR code is invalid or has been revoked');

async function requireDisplayableProfile(token: string) {
  if (!QR_TOKEN_PATTERN.test(token)) throw unavailable();
  const row = await findPublicProfileByToken(token);
  if (!row) throw unavailable();
  return row;
}

export async function getPublicProfile(token: string): Promise<PublicProfile> {
  const row = await requireDisplayableProfile(token);
  // Explicit whitelist: each public field is copied by name.
  return {
    fullName: row.fullName,
    dateOfBirth: row.dateOfBirth,
    age: calculateAge(row.dateOfBirth),
    gender: row.gender,
    address: row.address,
    familyPhone: row.familyPhone,
    bloodGroup: row.bloodGroup,
    weightKg: row.weightKg,
    heightCm: row.heightCm,
    avatarUrl: row.avatarKey
      ? `/api/qr/${token}/avatar?v=${sha256(row.avatarKey).slice(0, 12)}`
      : null,
  };
}

export async function loadPublicAvatar(token: string): Promise<StoredObject> {
  const row = await requireDisplayableProfile(token);
  const image = row.avatarKey ? await storage.get(row.avatarKey) : null;
  if (!image) throw new AppError(404, 'AVATAR_NOT_FOUND', 'Avatar not found');
  return image;
}
