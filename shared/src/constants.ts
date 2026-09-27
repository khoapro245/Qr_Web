export const USER_ROLES = ['ADMIN', 'CUSTOMER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const QR_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type QrStatus = (typeof QR_STATUSES)[number];

/** 16 random bytes, base64url-encoded. */
export const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Smallest accepted source image side; smaller photos look blurry on the QR page. */
export const AVATAR_MIN_DIMENSION = 64;

export const OTP_CHANNELS = ['EMAIL', 'SMS'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];
