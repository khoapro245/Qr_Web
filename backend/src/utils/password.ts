import { hash, verify } from '@node-rs/argon2';
import { randomInt } from 'node:crypto';

// Argon2id with OWASP's recommended minimum parameters (19 MiB memory, 2 iterations).
// `algorithm: 2` is Algorithm.Argon2id — the package exports a const enum, which cannot be
// imported under isolatedModules.
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash must fail closed, never throw into the login flow.
    return false;
  }
}

// Excludes look-alike characters (0/O, 1/l/I) because temporary passwords are printed on
// paper and typed by hand.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALPHABET = LOWER + UPPER + DIGITS;

function pick(chars: string): string {
  return chars[randomInt(chars.length)] as string;
}

/**
 * Generates a readable temporary password such as `hT4k-9mQx-Rw2p` (~70 bits of entropy),
 * guaranteed to contain lower case, upper case and digits.
 */
export function generateTemporaryPassword(): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < 12) chars.push(pick(ALPHABET));
  // Fisher–Yates shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  const raw = chars.join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
