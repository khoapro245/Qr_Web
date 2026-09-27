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

export const OTP_CHANNELS = ['EMAIL', 'SMS'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];
