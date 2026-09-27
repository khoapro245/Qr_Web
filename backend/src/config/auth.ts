export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Two browser tabs may refresh with the same token at the same moment. A token rotated this
// recently is treated as a benign race rather than theft.
export const REFRESH_REUSE_GRACE_MS = 30 * 1000;

export const COOKIE_NAMES = {
  access: 'qrc_at',
  refresh: 'qrc_rt',
  csrf: 'qrc_csrf',
} as const;

export const CSRF_HEADER = 'x-csrf-token';
