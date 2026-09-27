import { describe, expect, it } from 'vitest';
import {
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from '../../src/utils/password.js';

describe('password hashing', () => {
  it('produces an Argon2id hash that verifies only the original password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct horse battery');
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password')).toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('fails closed on a malformed stored hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('generateTemporaryPassword', () => {
  it('returns a readable grouped password with mixed character classes', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it('does not repeat', () => {
    const passwords = new Set(Array.from({ length: 500 }, generateTemporaryPassword));
    expect(passwords.size).toBe(500);
  });
});
