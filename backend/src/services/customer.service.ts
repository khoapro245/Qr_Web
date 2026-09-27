import {
  calculateAge,
  type AccountStatus,
  type CreateCustomer,
  type CustomerDetail,
  type CustomerProfileView,
  type CustomerSummary,
  type ListCustomersQuery,
  type OwnProfile,
  type Paginated,
  type ProfileFields,
  type UpdateCustomer,
} from '@qrcare/shared';
import { db } from '../db/client.js';
import type { CustomerProfile, QrCode } from '../db/schema.js';
import {
  findCustomerById,
  insertCustomer,
  listCustomers,
  updateCustomerProfile,
  updateCustomerUser,
  type CustomerListRow,
  type CustomerRecord,
} from '../repositories/customer.repository.js';
import { findActiveQr } from '../repositories/qr.repository.js';
import { revokeAllSessionsForUser } from '../repositories/session.repository.js';
import { updatePassword } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { sha256 } from '../utils/crypto.js';
import { generateTemporaryPassword, hashPassword } from '../utils/password.js';
import { uniqueViolationConstraint } from '../utils/pg-errors.js';
import { changedFields, recordAudit } from './audit.service.js';
import { issueQr, toQrView } from './qr.service.js';

// ---------------------------------------------------------------------------------------
// Mapping: every response is built field by field, so a new database column can never leak
// into the API by accident.

export function toProfileView(profile: CustomerProfile): CustomerProfileView {
  return {
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    age: calculateAge(profile.dateOfBirth),
    gender: profile.gender,
    address: profile.address,
    familyPhone: profile.familyPhone,
    bloodGroup: profile.bloodGroup,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    hasAvatar: profile.avatarKey !== null,
    // Derived from the storage key so it changes with every upload without revealing the key.
    avatarVersion: profile.avatarKey ? sha256(profile.avatarKey).slice(0, 12) : null,
  };
}

function toSummary(row: CustomerListRow): CustomerSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    age: calculateAge(row.dateOfBirth),
    hasActiveQr: row.hasActiveQr,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail({ user, profile }: CustomerRecord, qr: QrCode | undefined): CustomerDetail {
  return {
    id: user.id,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: (profile.updatedAt > user.updatedAt
      ? profile.updatedAt
      : user.updatedAt
    ).toISOString(),
    publicConsentAt: profile.publicConsentAt?.toISOString() ?? null,
    account: {
      email: user.email,
      phone: user.phone,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lockedUntil:
        user.lockedUntil && user.lockedUntil > new Date() ? user.lockedUntil.toISOString() : null,
    },
    profile: toProfileView(profile),
    qr: qr ? toQrView(qr) : null,
  };
}

function profileColumns(fields: ProfileFields) {
  return {
    fullName: fields.fullName,
    dateOfBirth: fields.dateOfBirth,
    gender: fields.gender,
    address: fields.address,
    familyPhone: fields.familyPhone,
    bloodGroup: fields.bloodGroup,
    weightKg: fields.weightKg,
    heightCm: fields.heightCm,
  };
}

/** Converts a duplicate email/phone into a field-level 409 the form can display. */
function rethrowDuplicate(err: unknown): never {
  const constraint = uniqueViolationConstraint(err);
  if (constraint === 'users_email_key') {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already in use', [
      { path: 'email', message: 'Email này đã được dùng cho tài khoản khác' },
    ]);
  }
  if (constraint === 'users_phone_key') {
    throw new AppError(409, 'PHONE_TAKEN', 'Phone number is already in use', [
      { path: 'phone', message: 'Số điện thoại này đã được dùng cho tài khoản khác' },
    ]);
  }
  throw err;
}

async function requireCustomer(id: string): Promise<CustomerRecord> {
  const record = await findCustomerById(id);
  if (!record) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  return record;
}

// ---------------------------------------------------------------------------------------
// Admin operations

export async function listCustomersForAdmin(
  query: ListCustomersQuery,
): Promise<Paginated<CustomerSummary>> {
  const { rows, total } = await listCustomers(query);
  return { items: rows.map(toSummary), page: query.page, pageSize: query.pageSize, total };
}

export async function recentCustomers(limit = 5): Promise<CustomerSummary[]> {
  const { rows } = await listCustomers({
    search: undefined,
    status: undefined,
    page: 1,
    pageSize: limit,
  });
  return rows.map(toSummary);
}

export async function getCustomerForAdmin(id: string): Promise<CustomerDetail> {
  const [record, qr] = await Promise.all([requireCustomer(id), findActiveQr(id)]);
  return toDetail(record, qr);
}

export async function createCustomer(
  adminId: string,
  input: CreateCustomer,
): Promise<{ customer: CustomerDetail; temporaryPassword: string | null }> {
  const generated = input.password === null;
  const password = input.password ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  try {
    // Account, profile and its first QR code are created together or not at all.
    const { record, qr } = await db.transaction(async (tx) => {
      const created = await insertCustomer(
        { email: input.email, phone: input.phone, passwordHash, mustChangePassword: true },
        { ...profileColumns(input), publicConsentAt: new Date() },
        tx,
      );
      await recordAudit(
        { actorUserId: adminId, action: 'CUSTOMER_CREATED', targetUserId: created.user.id },
        tx,
      );
      const issued = await issueQr(created.user.id, adminId, tx);
      return { record: created, qr: issued };
    });
    // A generated password is returned exactly once so the admin can hand it over with the
    // shirt; it is not stored anywhere in plaintext.
    return { customer: toDetail(record, qr), temporaryPassword: generated ? password : null };
  } catch (err) {
    rethrowDuplicate(err);
  }
}

export async function updateCustomer(
  adminId: string,
  id: string,
  input: UpdateCustomer,
): Promise<CustomerDetail> {
  const before = await requireCustomer(id);
  const profileValues = profileColumns(input);
  const userValues = { email: input.email, phone: input.phone };
  const changed = [
    ...changedFields(before.user, userValues),
    ...changedFields(before.profile, profileValues),
  ];

  try {
    await db.transaction(async (tx) => {
      await updateCustomerUser(id, userValues, tx);
      await updateCustomerProfile(id, profileValues, tx);
      await recordAudit(
        {
          actorUserId: adminId,
          action: 'CUSTOMER_UPDATED',
          targetUserId: id,
          metadata: { fields: changed },
        },
        tx,
      );
    });
  } catch (err) {
    rethrowDuplicate(err);
  }
  return getCustomerForAdmin(id);
}

/**
 * Deactivating also ends every session at once; the public QR stops showing the profile
 * because the public endpoint checks account status.
 */
export async function setCustomerStatus(
  adminId: string,
  id: string,
  status: AccountStatus,
): Promise<CustomerDetail> {
  const before = await requireCustomer(id);
  if (before.user.status !== status) {
    await db.transaction(async (tx) => {
      await updateCustomerUser(id, { status }, tx);
      if (status === 'INACTIVE') await revokeAllSessionsForUser(id, tx);
      await recordAudit(
        {
          actorUserId: adminId,
          action: 'CUSTOMER_STATUS_CHANGED',
          targetUserId: id,
          metadata: { from: before.user.status, to: status },
        },
        tx,
      );
    });
  }
  return getCustomerForAdmin(id);
}

/** Issues a new temporary password (e.g. the customer lost it). Shown to the admin once. */
export async function resetCustomerPassword(
  adminId: string,
  id: string,
): Promise<{ temporaryPassword: string }> {
  await requireCustomer(id);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.transaction(async (tx) => {
    await updatePassword(id, passwordHash, { mustChangePassword: true, now: new Date() }, tx);
    await revokeAllSessionsForUser(id, tx);
    await recordAudit(
      { actorUserId: adminId, action: 'CUSTOMER_PASSWORD_RESET', targetUserId: id },
      tx,
    );
  });
  return { temporaryPassword };
}

// ---------------------------------------------------------------------------------------
// Customer self-service

export async function getOwnProfile(userId: string): Promise<OwnProfile> {
  const { user, profile } = await requireCustomer(userId);
  return { account: { email: user.email, phone: user.phone }, profile: toProfileView(profile) };
}

export async function updateOwnProfile(userId: string, input: ProfileFields): Promise<OwnProfile> {
  const before = await requireCustomer(userId);
  const values = profileColumns(input);
  await db.transaction(async (tx) => {
    await updateCustomerProfile(userId, values, tx);
    await recordAudit(
      {
        actorUserId: userId,
        action: 'PROFILE_UPDATED_BY_OWNER',
        targetUserId: userId,
        metadata: { fields: changedFields(before.profile, values) },
      },
      tx,
    );
  });
  return getOwnProfile(userId);
}
