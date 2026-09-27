import {
  ACCOUNT_STATUSES,
  BLOOD_GROUPS,
  GENDERS,
  OTP_CHANNELS,
  QR_STATUSES,
  USER_ROLES,
} from '@qrcare/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const accountStatusEnum = pgEnum('account_status', ACCOUNT_STATUSES);
export const genderEnum = pgEnum('gender', GENDERS);
export const bloodGroupEnum = pgEnum('blood_group', BLOOD_GROUPS);
export const qrStatusEnum = pgEnum('qr_status', QR_STATUSES);
export const otpChannelEnum = pgEnum('otp_channel', OTP_CHANNELS);
export const otpPurposeEnum = pgEnum('otp_purpose', ['PASSWORD_RESET']);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const timestamps = {
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// E.164, e.g. +84912345678. Normalisation happens in the application layer.
const E164_PATTERN = '^\\+[1-9][0-9]{7,14}$';

/** Account-level data: identity, credentials and access state. Never exposed publicly. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: userRoleEnum('role').notNull(),
    status: accountStatusEnum('status').notNull().default('ACTIVE'),
    email: text('email'),
    phone: text('phone'),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamptz('locked_until'),
    passwordChangedAt: timestamptz('password_changed_at').notNull().defaultNow(),
    lastLoginAt: timestamptz('last_login_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_key').on(t.email),
    uniqueIndex('users_phone_key').on(t.phone),
    index('users_role_status_idx').on(t.role, t.status),
    check('users_email_or_phone_required', sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
    // Emails are stored lowercase so the unique index is effectively case-insensitive.
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('users_phone_e164', sql`${t.phone} ~ ${sql.raw(`'${E164_PATTERN}'`)}`),
    check('users_failed_login_count_non_negative', sql`${t.failedLoginCount} >= 0`),
  ],
);

/**
 * Profile data shown on the public QR page. Age is intentionally absent: it is always derived
 * from date_of_birth so it can never drift or be set manually.
 */
export const customerProfiles = pgTable(
  'customer_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'restrict' }),
    fullName: text('full_name').notNull(),
    dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
    gender: genderEnum('gender').notNull(),
    address: text('address'),
    familyPhone: text('family_phone').notNull(),
    bloodGroup: bloodGroupEnum('blood_group').notNull().default('UNKNOWN'),
    weightKg: numeric('weight_kg', { precision: 4, scale: 1, mode: 'number' }),
    heightCm: numeric('height_cm', { precision: 4, scale: 1, mode: 'number' }),
    // Storage object key, not a URL: avatars are served through the API so that revoking
    // a QR also revokes public access to the photo.
    avatarKey: text('avatar_key'),
    publicConsentAt: timestamptz('public_consent_at'),
    ...timestamps,
  },
  (t) => [
    check(
      'customer_profiles_full_name_length',
      sql`char_length(btrim(${t.fullName})) BETWEEN 1 AND 100`,
    ),
    check('customer_profiles_dob_min', sql`${t.dateOfBirth} >= DATE '1900-01-01'`),
    check('customer_profiles_address_length', sql`char_length(${t.address}) <= 255`),
    check(
      'customer_profiles_family_phone_e164',
      sql`${t.familyPhone} ~ ${sql.raw(`'${E164_PATTERN}'`)}`,
    ),
    check('customer_profiles_weight_range', sql`${t.weightKg} BETWEEN 1 AND 400`),
    check('customer_profiles_height_range', sql`${t.heightCm} BETWEEN 30 AND 260`),
  ],
);

/**
 * QR codes, including revoked ones for audit history. The partial unique index guarantees at
 * most one ACTIVE code per customer at the database level, even under concurrent requests.
 */
export const qrCodes = pgTable(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    token: text('token').notNull(),
    status: qrStatusEnum('status').notNull().default('ACTIVE'),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    revokedById: uuid('revoked_by_id').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    uniqueIndex('qr_codes_token_key').on(t.token),
    uniqueIndex('qr_codes_one_active_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'ACTIVE'`),
    index('qr_codes_user_id_idx').on(t.userId, t.createdAt),
    check(
      'qr_codes_revoked_consistency',
      sql`(${t.status} = 'REVOKED') = (${t.revokedAt} IS NOT NULL)`,
    ),
  ],
);

/** Refresh tokens are stored hashed. `familyId` links rotations so reuse revokes the chain. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    replacedById: uuid('replaced_by_id').references((): AnyPgColumn => refreshTokens.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_token_hash_key').on(t.tokenHash),
    index('refresh_tokens_user_id_idx').on(t.userId),
    index('refresh_tokens_family_id_idx').on(t.familyId),
  ],
);

/** OTPs and the short-lived reset token issued after a successful OTP check; both hashed. */
export const otpVerifications = pgTable(
  'otp_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: otpChannelEnum('channel').notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),
    otpHash: text('otp_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    verifiedAt: timestamptz('verified_at'),
    resetTokenHash: text('reset_token_hash'),
    resetTokenExpiresAt: timestamptz('reset_token_expires_at'),
    consumedAt: timestamptz('consumed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('otp_verifications_user_purpose_idx').on(t.userId, t.purpose, t.createdAt),
    uniqueIndex('otp_verifications_reset_token_hash_key').on(t.resetTokenHash),
    check('otp_verifications_attempt_count_non_negative', sql`${t.attemptCount} >= 0`),
  ],
);

/**
 * Admin/security events. `metadata` must only hold non-personal values (field names, status
 * transitions, QR ids) — never profile contents, credentials, OTPs or QR tokens.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_target_user_idx').on(t.targetUserId, t.createdAt),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;
export type QrCode = typeof qrCodes.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
