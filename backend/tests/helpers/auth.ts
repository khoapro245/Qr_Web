import type { Express } from 'express';
import request from 'supertest';
import { hashPassword } from '../../src/utils/password.js';
import { insertCustomerProfile, insertUser } from './db.js';

export const TEST_PASSWORD = 'Password123';

/**
 * A cookie-keeping client that behaves like the SPA: it fetches a CSRF token first and sends
 * it on every state-changing request.
 */
export async function createClient(app: Express) {
  const agent = request.agent(app);
  const res = await agent.get('/api/auth/csrf');
  const state = { csrfToken: res.body.data.csrfToken as string };

  // Like the SPA, always echo the *current* CSRF cookie (the server rotates it on login).
  const send = async (req: request.Test, body?: object) => {
    const response = await req.set('X-CSRF-Token', state.csrfToken).send(body);
    const rotated = getCookie(response, 'qrc_csrf');
    if (rotated) state.csrfToken = rotated.split(';')[0]!.split('=')[1]!;
    return response;
  };

  return {
    agent,
    get csrfToken() {
      return state.csrfToken;
    },
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => send(agent.post(url), body),
    put: (url: string, body?: object) => send(agent.put(url), body),
    patch: (url: string, body?: object) => send(agent.patch(url), body),
    login: (identifier: string, password = TEST_PASSWORD) =>
      send(agent.post('/api/auth/login'), { identifier, password }),
  };
}

export type TestClient = Awaited<ReturnType<typeof createClient>>;

let passwordHash: Promise<string> | undefined;
function testPasswordHash() {
  passwordHash ??= hashPassword(TEST_PASSWORD);
  return passwordHash;
}

export async function createAdmin(overrides: Parameters<typeof insertUser>[0] = {}) {
  return insertUser({
    role: 'ADMIN',
    passwordHash: await testPasswordHash(),
    mustChangePassword: false,
    ...overrides,
  });
}

export async function createCustomer(overrides: Parameters<typeof insertUser>[0] = {}) {
  const user = await insertUser({
    role: 'CUSTOMER',
    passwordHash: await testPasswordHash(),
    mustChangePassword: false,
    ...overrides,
  });
  await insertCustomerProfile(user.id);
  return user;
}

export async function loggedInClient(app: Express, identifier: string) {
  const client = await createClient(app);
  const res = await client.login(identifier);
  if (res.status !== 200) throw new Error(`Login failed in test setup: ${res.status}`);
  return client;
}

/** Extracts the raw Set-Cookie value (`name=value`) for a cookie, if present. */
export function getCookie(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`));
}
