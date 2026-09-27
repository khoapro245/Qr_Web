import type { UserRole } from './constants.js';

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
