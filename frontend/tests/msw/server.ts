import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export function apiError(status: number, code: string, details?: unknown) {
  return HttpResponse.json({ success: false, code, message: code, details }, { status });
}

export function apiOk<T>(data: T) {
  return HttpResponse.json({ success: true, data });
}

/** Default handlers: no session. Tests override with server.use(...). */
export const server = setupServer(
  http.get('/api/auth/csrf', () => apiOk({ csrfToken: 'test-csrf' })),
  http.get('/api/auth/me', () => apiError(401, 'UNAUTHENTICATED')),
  http.post('/api/auth/refresh', () => apiError(401, 'SESSION_EXPIRED')),
  http.post('/api/auth/logout', () => apiOk(null)),
);
