import { calculateAge } from '@qrcare/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { auditLogs, customerProfiles, users } from '../src/db/schema.js';
import {
  createAdmin,
  createClient,
  createCustomer,
  loggedInClient,
  type TestClient,
} from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();

const validCustomer = {
  fullName: '  Nguyễn Văn A  ',
  dateOfBirth: '2006-03-19',
  gender: 'MALE',
  address: '12 Lê Lợi, Quận 1, TP.HCM',
  familyPhone: '028 3823 4567',
  bloodGroup: 'O+',
  weightKg: '60,5',
  heightCm: 170,
  email: 'Customer@Example.com',
  phone: '0912 345 678',
  password: '',
  publicConsent: true,
};

let admin: TestClient;

async function createViaApi(overrides: Record<string, unknown> = {}) {
  return admin.post('/api/admin/users', { ...validCustomer, ...overrides });
}

describe('customer management (admin)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await createAdmin({ email: 'admin@example.com' });
    admin = await loggedInClient(app, 'admin@example.com');
  });

  describe('create', () => {
    it('creates a customer with normalised data and a one-time temporary password', async () => {
      const res = await createViaApi();
      expect(res.status).toBe(201);

      const { customer, temporaryPassword } = res.body.data;
      expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(customer.account).toMatchObject({
        email: 'customer@example.com',
        phone: '+84912345678',
        mustChangePassword: true,
      });
      expect(customer.profile).toMatchObject({
        fullName: 'Nguyễn Văn A',
        dateOfBirth: '2006-03-19',
        age: calculateAge('2006-03-19'),
        familyPhone: '+842838234567',
        weightKg: 60.5,
        heightCm: 170,
        hasAvatar: false,
      });
      expect(customer.publicConsentAt).not.toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|argon2/);

      // The temporary password works, and must be changed on first login.
      const customerClient = await createClient(app);
      const login = await customerClient.login('0912345678', temporaryPassword);
      expect(login.status).toBe(200);
      expect(login.body.data.user.mustChangePassword).toBe(true);
    });

    it('does not echo a password chosen by the admin', async () => {
      const res = await createViaApi({ password: 'Chosen2024pass' });
      expect(res.status).toBe(201);
      expect(res.body.data.temporaryPassword).toBeNull();
      const client = await createClient(app);
      expect((await client.login('customer@example.com', 'Chosen2024pass')).status).toBe(200);
    });

    it('ignores any client-supplied age and derives it from the date of birth', async () => {
      const res = await createViaApi({ age: 99 });
      expect(res.body.data.customer.profile.age).toBe(calculateAge('2006-03-19'));
    });

    it('accepts a phone-only customer', async () => {
      const res = await createViaApi({ email: '' });
      expect(res.status).toBe(201);
      expect(res.body.data.customer.account.email).toBeNull();
    });

    it.each([
      ['missing name', { fullName: ' ' }, 'fullName'],
      ['future date of birth', { dateOfBirth: '2999-01-01' }, 'dateOfBirth'],
      ['impossible date', { dateOfBirth: '2006-02-30' }, 'dateOfBirth'],
      ['unknown gender', { gender: 'X' }, 'gender'],
      ['bad family phone', { familyPhone: '12345' }, 'familyPhone'],
      ['weight out of range', { weightKg: 0 }, 'weightKg'],
      ['height out of range', { heightCm: '999' }, 'heightCm'],
      ['no login identifier', { email: '', phone: '' }, 'email'],
      ['invalid email', { email: 'not-an-email' }, 'email'],
      ['weak chosen password', { password: 'short' }, 'password'],
      ['missing consent', { publicConsent: false }, 'publicConsent'],
    ])('rejects %s', async (_label, overrides, field) => {
      const res = await createViaApi(overrides);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain(field);
    });

    it('reports every problem at once, including the missing login identifier', async () => {
      const res = await createViaApi({ fullName: '', email: '', phone: '' });
      expect(res.status).toBe(400);
      const fields = res.body.details.map((d: { path: string }) => d.path);
      expect(fields).toEqual(expect.arrayContaining(['fullName', 'email']));
    });

    it('reports duplicate email and phone as field errors', async () => {
      await createViaApi();
      const dupEmail = await createViaApi({ phone: '0987654321' });
      expect(dupEmail.status).toBe(409);
      expect(dupEmail.body.code).toBe('EMAIL_TAKEN');
      expect(dupEmail.body.details[0].path).toBe('email');

      const dupPhone = await createViaApi({ email: 'other@example.com' });
      expect(dupPhone.status).toBe(409);
      expect(dupPhone.body.code).toBe('PHONE_TAKEN');
    });

    it('writes an audit entry without personal data', async () => {
      const res = await createViaApi();
      const [entry] = await db.select().from(auditLogs);
      expect(entry).toMatchObject({
        action: 'CUSTOMER_CREATED',
        targetUserId: res.body.data.customer.id,
      });
      expect(JSON.stringify(entry)).not.toMatch(/Nguyễn|0912|customer@example/);
    });
  });

  describe('list and search', () => {
    beforeEach(async () => {
      await createViaApi({
        fullName: 'Nguyễn Văn An',
        email: 'an@example.com',
        phone: '0911111111',
      });
      await createViaApi({
        fullName: 'Trần Thị Bình',
        email: 'binh@example.com',
        phone: '0922222222',
      });
      await createViaApi({
        fullName: 'Đặng Đức Cường',
        email: 'cuong@example.com',
        phone: '0933333333',
      });
    });

    async function search(params: Record<string, string>) {
      const res = await admin.get(`/api/admin/users?${new URLSearchParams(params).toString()}`);
      expect(res.status).toBe(200);
      return res.body.data;
    }

    it('lists customers newest first with pagination info', async () => {
      const data = await search({ pageSize: '2' });
      expect(data.total).toBe(3);
      expect(data.items).toHaveLength(2);
      expect(data.items[0].fullName).toBe('Đặng Đức Cường');
      expect(Object.keys(data.items[0]).sort()).toEqual(
        ['age', 'createdAt', 'email', 'fullName', 'hasActiveQr', 'id', 'phone', 'status'].sort(),
      );
    });

    it('searches names without accents', async () => {
      expect(
        (await search({ search: 'nguyen' })).items.map((c: { fullName: string }) => c.fullName),
      ).toEqual(['Nguyễn Văn An']);
      expect((await search({ search: 'dang duc' })).total).toBe(1);
    });

    it('searches by email and by phone in local format', async () => {
      expect((await search({ search: 'binh@' })).items[0].fullName).toBe('Trần Thị Bình');
      expect((await search({ search: '0933 333' })).items[0].fullName).toBe('Đặng Đức Cường');
    });

    it('treats LIKE wildcards in the search literally', async () => {
      expect((await search({ search: '%' })).total).toBe(0);
    });

    it('filters by status', async () => {
      const [first] = (await search({ search: 'binh' })).items;
      await admin.patch(`/api/admin/users/${first.id}/status`, { status: 'INACTIVE' });
      expect(
        (await search({ status: 'INACTIVE' })).items.map((c: { fullName: string }) => c.fullName),
      ).toEqual(['Trần Thị Bình']);
      expect((await search({ status: 'ACTIVE' })).total).toBe(2);
    });

    it('rejects an invalid status filter', async () => {
      const res = await admin.get('/api/admin/users?status=DELETED');
      expect(res.status).toBe(400);
    });
  });

  describe('detail, update, status and password reset', () => {
    let customerId: string;

    beforeEach(async () => {
      customerId = (await createViaApi()).body.data.customer.id;
    });

    it('returns 404 for unknown, malformed and non-customer ids', async () => {
      const [adminRow] = await db.select().from(users).where(eq(users.role, 'ADMIN'));
      for (const id of ['00000000-0000-4000-8000-000000000000', 'abc', adminRow!.id]) {
        const res = await admin.get(`/api/admin/users/${id}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('CUSTOMER_NOT_FOUND');
      }
    });

    it('updates profile and login identifiers and audits only field names', async () => {
      const res = await admin.put(`/api/admin/users/${customerId}`, {
        ...validCustomer,
        fullName: 'Nguyễn Văn B',
        phone: '0987654321',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.customer.profile.fullName).toBe('Nguyễn Văn B');
      expect(res.body.data.customer.account.phone).toBe('+84987654321');

      const [entry] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'CUSTOMER_UPDATED'));
      expect(entry?.metadata).toEqual({ fields: ['phone', 'fullName'] });
    });

    it('deactivation ends sessions and blocks login; reactivation restores it', async () => {
      const { temporaryPassword } = (
        await admin.post(`/api/admin/users/${customerId}/reset-password`)
      ).body.data;
      const session = await createClient(app);
      await session.login('customer@example.com', temporaryPassword);
      await session.post('/api/auth/change-password', {
        currentPassword: temporaryPassword,
        newPassword: 'MyOwnPass2024',
      });
      expect((await session.get('/api/me/profile')).status).toBe(200);

      const off = await admin.patch(`/api/admin/users/${customerId}/status`, {
        status: 'INACTIVE',
      });
      expect(off.status).toBe(200);
      expect(off.body.data.customer.status).toBe('INACTIVE');
      expect((await session.get('/api/me/profile')).status).toBe(401);
      const blocked = await (
        await createClient(app)
      ).login('customer@example.com', 'MyOwnPass2024');
      expect(blocked.body.code).toBe('ACCOUNT_INACTIVE');

      await admin.patch(`/api/admin/users/${customerId}/status`, { status: 'ACTIVE' });
      const back = await (await createClient(app)).login('customer@example.com', 'MyOwnPass2024');
      expect(back.status).toBe(200);
    });

    it('resets the password to a new temporary one', async () => {
      const res = await admin.post(`/api/admin/users/${customerId}/reset-password`);
      expect(res.status).toBe(200);
      const { temporaryPassword } = res.body.data;
      const client = await createClient(app);
      const login = await client.login('customer@example.com', temporaryPassword);
      expect(login.status).toBe(200);
      expect(login.body.data.user.mustChangePassword).toBe(true);
    });
  });
});

describe('customer self-service', () => {
  let customer: TestClient;
  let customerUserId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await createCustomer({ email: 'me@example.com', phone: '+84912345678' });
    customerUserId = user.id;
    customer = await loggedInClient(app, 'me@example.com');
  });

  it('shows the own profile with derived age and login info', async () => {
    const res = await customer.get('/api/me/profile');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      account: { email: 'me@example.com', phone: '+84912345678' },
      profile: expect.objectContaining({
        fullName: 'Nguyễn Văn A',
        age: calculateAge('2006-03-19'),
        hasAvatar: false,
      }),
    });
  });

  it('lets the customer edit permitted fields only', async () => {
    await db
      .update(customerProfiles)
      .set({ avatarKey: 'avatars/original.webp' })
      .where(eq(customerProfiles.userId, customerUserId));

    const res = await customer.put('/api/me/profile', {
      fullName: 'Nguyễn Văn Mới',
      dateOfBirth: '2000-01-01',
      gender: 'MALE',
      address: '',
      familyPhone: '0911222333',
      bloodGroup: 'A+',
      weightKg: 55,
      heightCm: '',
      // Not editable by customers — must be ignored:
      email: 'hacker@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      avatarKey: 'avatars/evil.webp',
      age: 5,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject({
      fullName: 'Nguyễn Văn Mới',
      address: null,
      heightCm: null,
      age: calculateAge('2000-01-01'),
      hasAvatar: true,
    });

    const [user] = await db.select().from(users).where(eq(users.id, customerUserId));
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, customerUserId));
    expect(user?.email).toBe('me@example.com');
    expect(user?.role).toBe('CUSTOMER');
    expect(profile?.avatarKey).toBe('avatars/original.webp');
  });

  it('validates the profile on the server', async () => {
    const res = await customer.put('/api/me/profile', { fullName: '', dateOfBirth: 'x' });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { path: string }) => d.path);
    expect(fields).toEqual(
      expect.arrayContaining(['fullName', 'dateOfBirth', 'gender', 'familyPhone']),
    );
  });

  it('cannot reach admin customer management', async () => {
    for (const res of [
      await customer.get('/api/admin/users'),
      await customer.get(`/api/admin/users/${customerUserId}`),
      await customer.post('/api/admin/users', validCustomer),
      await customer.patch(`/api/admin/users/${customerUserId}/status`, { status: 'ACTIVE' }),
    ]) {
      expect(res.status).toBe(403);
    }
  });

  it('is not reachable by admins or anonymous visitors', async () => {
    await createAdmin({ email: 'admin@example.com' });
    const adminClient = await loggedInClient(app, 'admin@example.com');
    expect((await adminClient.get('/api/me/profile')).status).toBe(403);
    expect((await request(app).get('/api/me/profile')).status).toBe(401);
  });
});
