import type { AccountStatus, BloodGroup, Gender, QrStatus, UserRole } from './constants.js';

/** The signed-in account as returned by the auth endpoints. Never contains credentials. */
export interface AuthUser {
  id: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  displayName: string;
  mustChangePassword: boolean;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  activeQrCodes: number;
  revokedQrCodes: number;
}

/** Profile data as stored. `age` is always derived from `dateOfBirth` by the server. */
export interface CustomerProfileView {
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: Gender;
  address: string | null;
  familyPhone: string;
  bloodGroup: BloodGroup;
  weightKg: number | null;
  heightCm: number | null;
  hasAvatar: boolean;
  /** Changes whenever the avatar changes; append to the image URL to bypass stale images. */
  avatarVersion: string | null;
}

/**
 * Everything a person scanning a QR code may see — an explicit whitelist (spec §20).
 * No ids, login email/phone, account status or anything else ever leaves through this type.
 */
export interface PublicProfile {
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: Gender;
  address: string | null;
  familyPhone: string;
  bloodGroup: BloodGroup;
  weightKg: number | null;
  heightCm: number | null;
  avatarUrl: string | null;
}

/** One row of the admin customer list. */
export interface CustomerSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: AccountStatus;
  age: number;
  hasActiveQr: boolean;
  createdAt: string;
}

export interface CustomerAccountView {
  email: string | null;
  phone: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
}

export interface QrCodeView {
  id: string;
  status: QrStatus;
  /** The public link encoded in the QR. Only present for the active code. */
  url: string | null;
  /** Last characters of the token, enough to tell codes apart in the history. */
  tokenHint: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CustomerQrInfo {
  current: QrCodeView | null;
  /** All codes, newest first, including the current one. */
  history: QrCodeView[];
}

/** Admin view of one customer, split into the sections shown on the detail page. */
export interface CustomerDetail {
  id: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  publicConsentAt: string | null;
  account: CustomerAccountView;
  profile: CustomerProfileView;
  qr: QrCodeView | null;
}

/** What a customer sees about themselves. */
export interface OwnProfile {
  account: { email: string | null; phone: string | null };
  profile: CustomerProfileView;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentCustomers: CustomerSummary[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  code: string;
  message: string;
  details?: unknown;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
