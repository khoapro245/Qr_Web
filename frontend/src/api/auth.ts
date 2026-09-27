import type { AuthUser } from '@qrcare/shared';
import { api, getApiError, unwrap } from './client';

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await unwrap<{ user: AuthUser }>(api.get('/auth/me'));
    return data.user;
  } catch (err) {
    const code = getApiError(err)?.code;
    if (code === 'UNAUTHENTICATED' || code === 'ACCOUNT_INACTIVE') return null;
    throw err;
  }
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const data = await unwrap<{ user: AuthUser }>(
    api.post('/auth/login', { identifier, password }, { skipAuthRefresh: true }),
  );
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', undefined, { skipAuthRefresh: true });
}

export async function requestPasswordReset(identifier: string): Promise<void> {
  await api.post('/auth/forgot-password', { identifier }, { skipAuthRefresh: true });
}

export async function verifyResetOtp(identifier: string, otp: string): Promise<string> {
  const data = await unwrap<{ resetToken: string }>(
    api.post('/auth/verify-otp', { identifier, otp }, { skipAuthRefresh: true }),
  );
  return data.resetToken;
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { resetToken, newPassword }, { skipAuthRefresh: true });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthUser> {
  const data = await unwrap<{ user: AuthUser }>(
    api.post('/auth/change-password', { currentPassword, newPassword }),
  );
  return data.user;
}
