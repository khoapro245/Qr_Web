import type {
  AuthUser,
  CustomerDetail,
  CustomerSummary,
  DashboardStats,
  OwnProfile,
} from '@qrcare/shared';
import { http } from 'msw';
import { apiOk, server } from './msw/server';

export const adminUser: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'ADMIN',
  email: 'admin@example.com',
  phone: null,
  displayName: 'admin@example.com',
  mustChangePassword: false,
};

export const customerUser: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'CUSTOMER',
  email: null,
  phone: '+84912345678',
  displayName: 'Nguyễn Văn A',
  mustChangePassword: false,
};

export const stats: DashboardStats = {
  totalCustomers: 12,
  activeCustomers: 10,
  inactiveCustomers: 2,
  activeQrCodes: 9,
  revokedQrCodes: 3,
};

export const customerDetail: CustomerDetail = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'ACTIVE',
  createdAt: '2026-09-01T03:00:00.000Z',
  updatedAt: '2026-09-01T03:00:00.000Z',
  publicConsentAt: '2026-09-01T03:00:00.000Z',
  account: {
    email: 'khach@example.com',
    phone: '+84912345678',
    mustChangePassword: true,
    lastLoginAt: null,
    lockedUntil: null,
  },
  profile: {
    fullName: 'Nguyễn Văn A',
    dateOfBirth: '2006-03-19',
    age: 20,
    gender: 'MALE',
    address: '12 Lê Lợi, Quận 1',
    familyPhone: '+84987654321',
    bloodGroup: 'O+',
    weightKg: 60.5,
    heightCm: 170,
    hasAvatar: false,
    avatarVersion: null,
  },
  qr: {
    id: '44444444-4444-4444-8444-444444444444',
    status: 'ACTIVE',
    url: 'http://localhost:5173/qr/AbCdEfGhIjKlMnOpQrStUv',
    tokenHint: 'StUv',
    createdAt: '2026-09-01T03:00:00.000Z',
    revokedAt: null,
  },
};

export const withAvatar = (detail: CustomerDetail): CustomerDetail => ({
  ...detail,
  profile: { ...detail.profile, hasAvatar: true, avatarVersion: 'abc123def456' },
});

export const customerSummary: CustomerSummary = {
  id: customerDetail.id,
  fullName: customerDetail.profile.fullName,
  email: customerDetail.account.email,
  phone: customerDetail.account.phone,
  status: 'ACTIVE',
  age: 20,
  hasActiveQr: false,
  createdAt: customerDetail.createdAt,
};

export const ownProfile: OwnProfile = {
  account: { email: null, phone: '+84912345678' },
  profile: customerDetail.profile,
};

export function signedInAs(user: AuthUser) {
  server.use(http.get('/api/auth/me', () => apiOk({ user })));
}

export function dashboardReturns(data: DashboardStats) {
  server.use(
    http.get('/api/admin/dashboard', () =>
      apiOk({ stats: data, recentCustomers: [customerSummary] }),
    ),
  );
}
