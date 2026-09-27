import { eq } from 'drizzle-orm';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { auditLogs, customerProfiles } from '../src/db/schema.js';
import { createAdmin, createCustomer, loggedInClient, type TestClient } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const app = createApp();
const avatarDir = join(env.STORAGE_LOCAL_DIR, 'avatars');

function solidImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#0f766e' } });
}

async function storedAvatarFiles(): Promise<string[]> {
  try {
    return await readdir(avatarDir);
  } catch {
    return [];
  }
}

let admin: TestClient;
let customerId: string;

function upload(file: Buffer, filename = 'photo.png', contentType = 'image/png') {
  return admin.agent
    .put(`/api/admin/users/${customerId}/avatar`)
    .set('X-CSRF-Token', admin.csrfToken)
    .attach('avatar', file, { filename, contentType });
}

describe('avatars', () => {
  beforeEach(async () => {
    await resetDatabase();
    await rm(env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
    await createAdmin({ email: 'admin@example.com' });
    customerId = (await createCustomer({ email: 'c@example.com' })).id;
    admin = await loggedInClient(app, 'admin@example.com');
  });

  it('re-encodes an upload to a 512×512 WebP and serves it to the admin', async () => {
    const res = await upload(await solidImage(800, 600).png().toBuffer());
    expect(res.status).toBe(200);
    expect(res.body.data.customer.profile.hasAvatar).toBe(true);
    expect(res.body.data.customer.profile.avatarVersion).toMatch(/^[0-9a-f]{12}$/);

    const image = await admin.get(`/api/admin/users/${customerId}/avatar`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    expect(image.headers['cache-control']).toBe('no-store');
    const meta = await sharp(image.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });

    const [entry] = await db.select().from(auditLogs);
    expect(entry?.action).toBe('CUSTOMER_AVATAR_UPDATED');
  });

  it('removes EXIF metadata such as GPS location from phone photos', async () => {
    const photo = await solidImage(600, 600)
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'Private owner', Artist: 'Phone camera' },
        IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
      })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    expect((await upload(photo, 'IMG_0001.jpg', 'image/jpeg')).status).toBe(200);
    const image = await admin.get(`/api/admin/users/${customerId}/avatar`);
    const meta = await sharp(image.body as Buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect((image.body as Buffer).toString('latin1')).not.toContain('Private owner');
  });

  it('never uses the client file name for storage', async () => {
    await upload(await solidImage(200, 200).png().toBuffer(), '../../etc/passwd.png');
    const files = await storedAvatarFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[A-Za-z0-9_-]{24}\.webp$/);
  });

  it('replaces the previous file when a new avatar is uploaded', async () => {
    await upload(await solidImage(200, 200).png().toBuffer());
    const first = await storedAvatarFiles();
    const res = await upload(await solidImage(300, 300).webp().toBuffer(), 'b.webp', 'image/webp');
    expect(res.status).toBe(200);
    const second = await storedAvatarFiles();
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe(first[0]);
  });

  it.each([
    ['text disguised as PNG', Buffer.from('definitely not an image'), 'INVALID_IMAGE', 400],
    [
      'an SVG (could carry scripts)',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script><rect width="200" height="200"/></svg>',
      ),
      'INVALID_IMAGE',
      400,
    ],
  ])('rejects %s', async (_label, file, code, status) => {
    const res = await upload(file);
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(await storedAvatarFiles()).toHaveLength(0);
  });

  it('rejects images that are too small', async () => {
    const res = await upload(await solidImage(32, 32).png().toBuffer());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IMAGE_TOO_SMALL');
  });

  it('rejects files over 5 MB before processing them', async () => {
    const res = await upload(Buffer.alloc(5 * 1024 * 1024 + 1, 1));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('requires a file in the avatar field', async () => {
    const missing = await admin.agent
      .put(`/api/admin/users/${customerId}/avatar`)
      .set('X-CSRF-Token', admin.csrfToken)
      .field('note', 'no file');
    expect(missing.status).toBe(400);
    const wrongField = await admin.agent
      .put(`/api/admin/users/${customerId}/avatar`)
      .set('X-CSRF-Token', admin.csrfToken)
      .attach('picture', await solidImage(100, 100).png().toBuffer(), 'a.png');
    expect(wrongField.status).toBe(400);
  });

  it('answers a malformed multipart body with 400, not 500', async () => {
    const truncated = await admin.agent
      .put(`/api/admin/users/${customerId}/avatar`)
      .set('X-CSRF-Token', admin.csrfToken)
      .set('Content-Type', 'multipart/form-data; boundary=XYZ')
      .send('--XYZ\r\nContent-Disposition: form-data; name="avatar"; filename="a.png"\r\n\r\ncut');
    expect(truncated.status).toBe(400);
    expect(truncated.body.code).toBe('INVALID_UPLOAD');

    const empty = await admin.agent
      .put(`/api/admin/users/${customerId}/avatar`)
      .set('X-CSRF-Token', admin.csrfToken)
      .set('Content-Type', 'multipart/form-data; boundary=XYZ')
      .send('--XYZ--\r\n');
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('FILE_REQUIRED');
  });

  it('deletes the avatar and its file', async () => {
    await upload(await solidImage(200, 200).png().toBuffer());
    const res = await admin.agent
      .delete(`/api/admin/users/${customerId}/avatar`)
      .set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.data.customer.profile).toMatchObject({ hasAvatar: false, avatarVersion: null });
    expect(await storedAvatarFiles()).toHaveLength(0);
    expect((await admin.get(`/api/admin/users/${customerId}/avatar`)).status).toBe(404);
  });

  it('returns 404 for a customer without an avatar or an unknown customer', async () => {
    expect((await admin.get(`/api/admin/users/${customerId}/avatar`)).body.code).toBe(
      'AVATAR_NOT_FOUND',
    );
    expect(
      (await admin.get('/api/admin/users/00000000-0000-4000-8000-000000000000/avatar')).status,
    ).toBe(404);
  });

  describe('customer access', () => {
    let customer: TestClient;

    beforeEach(async () => {
      await upload(await solidImage(200, 200).png().toBuffer());
      customer = await loggedInClient(app, 'c@example.com');
    });

    it('can view but not change their own avatar', async () => {
      const own = await customer.get('/api/me/avatar');
      expect(own.status).toBe(200);
      expect(own.headers['content-type']).toBe('image/webp');

      const attempt = await customer.agent
        .put(`/api/admin/users/${customerId}/avatar`)
        .set('X-CSRF-Token', customer.csrfToken)
        .attach('avatar', await solidImage(100, 100).png().toBuffer(), 'x.png');
      expect(attempt.status).toBe(403);

      const noSelfUpload = await customer.agent
        .put('/api/me/avatar')
        .set('X-CSRF-Token', customer.csrfToken)
        .attach('avatar', await solidImage(100, 100).png().toBuffer(), 'x.png');
      expect(noSelfUpload.status).toBe(404);

      const removal = await customer.agent
        .delete(`/api/admin/users/${customerId}/avatar`)
        .set('X-CSRF-Token', customer.csrfToken);
      expect(removal.status).toBe(403);

      const [profile] = await db
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, customerId));
      expect(profile?.avatarKey).not.toBeNull();
    });

    it("cannot fetch other customers' avatars through the admin route", async () => {
      expect((await customer.get(`/api/admin/users/${customerId}/avatar`)).status).toBe(403);
    });
  });

  it('is not available to anonymous visitors', async () => {
    await upload(await solidImage(200, 200).png().toBuffer());
    expect((await request(app).get(`/api/admin/users/${customerId}/avatar`)).status).toBe(401);
    expect((await request(app).get('/api/me/avatar')).status).toBe(401);
  });
});
