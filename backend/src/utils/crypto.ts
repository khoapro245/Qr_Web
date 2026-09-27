import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** URL-safe random string with `bytes` bytes of entropy from the OS CSPRNG. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 hex digest. Suitable for high-entropy secrets (refresh/reset tokens) only;
 * never for passwords or short codes.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
