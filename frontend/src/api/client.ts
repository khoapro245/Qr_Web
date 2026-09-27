import type { ApiErrorBody, ApiSuccess } from '@qrcare/shared';
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Do not attempt a session refresh when this request returns 401. */
    skipAuthRefresh?: boolean;
    _retried?: boolean;
  }
}

const CSRF_COOKIE = 'qrc_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20_000,
});

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

let csrfRequest: Promise<void> | null = null;

/** Makes sure the CSRF cookie exists before the first state-changing request. */
async function ensureCsrfCookie(): Promise<void> {
  if (readCookie(CSRF_COOKIE)) return;
  csrfRequest ??= axios
    .get('/api/auth/csrf', { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      csrfRequest = null;
    });
  await csrfRequest;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    await ensureCsrfCookie();
    const token = readCookie(CSRF_COOKIE);
    if (token) config.headers.set('X-CSRF-Token', token);
  }
  return config;
});

let refreshRequest: Promise<boolean> | null = null;

/**
 * Refreshes the session once, even if many requests fail at the same time. A
 * REFRESH_CONFLICT means another tab refreshed first — the new cookies are already set.
 */
function refreshSession(): Promise<boolean> {
  refreshRequest ??= api
    .post('/auth/refresh', undefined, { skipAuthRefresh: true })
    .then(() => true)
    .catch((err: unknown) => getApiError(err)?.code === 'REFRESH_CONFLICT')
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

export type SessionEndReason = 'expired' | 'inactive';

let sessionExpiredHandler: ((reason: SessionEndReason) => void) | null = null;

export function onSessionExpired(handler: (reason: SessionEndReason) => void): void {
  sessionExpiredHandler = handler;
}

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || !error.config) throw error;
  const config: AxiosRequestConfig = error.config;
  const code = getApiError(error)?.code;

  if (
    error.response?.status === 401 &&
    code === 'UNAUTHENTICATED' &&
    !config.skipAuthRefresh &&
    !config._retried
  ) {
    config._retried = true;
    if (await refreshSession()) return api(config);
    sessionExpiredHandler?.('expired');
  } else if (error.response?.status === 401 && code === 'ACCOUNT_INACTIVE') {
    sessionExpiredHandler?.('inactive');
  }
  throw error;
});

export function getApiError(error: unknown): ApiErrorBody | null {
  if (error instanceof AxiosError) {
    const data: unknown = error.response?.data;
    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      return data as ApiErrorBody;
    }
  }
  return null;
}

/** Unwraps the `{ success, data }` envelope. */
export async function unwrap<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  const response = await request;
  return response.data.data;
}
