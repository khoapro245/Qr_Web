import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { E2E } from './config.js';

export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** A Vietnamese mobile number unlikely to collide with other test customers. */
export function randomMobile(): string {
  return `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

/** A real 600×400 PNG, like a photo an admin would upload. */
export async function photoPng(): Promise<Buffer> {
  return sharp({ create: { width: 600, height: 400, channels: 3, background: '#0f766e' } })
    .composite([
      {
        input: await sharp({
          create: { width: 200, height: 200, channels: 3, background: '#fde68a' },
        })
          .png()
          .toBuffer(),
        top: 60,
        left: 200,
      },
    ])
    .png()
    .toBuffer();
}

/** Reads the URL encoded in a QR image. */
export async function decodeQr(image: Buffer): Promise<string | null> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR.default(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

async function csrfHeader(context: BrowserContext): Promise<Record<string, string>> {
  const cookie = (await context.cookies()).find((c) => c.name === 'qrc_csrf');
  if (!cookie) throw new Error('No CSRF cookie in this browser context');
  return { 'X-CSRF-Token': cookie.value };
}

export interface CreatedCustomer {
  id: string;
  email: string;
  phone: string;
  password: string;
  fullName: string;
  qrUrl: string;
}

/**
 * Creates a customer through the real admin API using the page's signed-in admin session —
 * a fast way to set up data for tests that are about something else.
 */
export async function createCustomerViaApi(
  page: Page,
  overrides: Partial<Record<string, unknown>> = {},
  options: { withPhoto?: boolean } = {},
): Promise<CreatedCustomer> {
  await page.goto('/admin');
  const suffix = uniqueSuffix();
  const body = {
    fullName: `Khách Thử ${suffix}`,
    dateOfBirth: '1950-06-15',
    gender: 'FEMALE',
    address: '12 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    familyPhone: '0912 888 777',
    bloodGroup: 'B+',
    weightKg: '50,5',
    heightCm: '155',
    email: `kh${suffix}@e2e.qrcare.test`,
    phone: randomMobile(),
    password: 'Khach-Pass-2026',
    publicConsent: true,
    ...overrides,
  };
  const headers = await csrfHeader(page.context());
  const res = await page.request.post('/api/admin/users', { data: body, headers });
  expect(res.status(), await res.text()).toBe(201);
  const { customer } = (
    (await res.json()) as {
      data: { customer: { id: string; qr: { url: string } } };
    }
  ).data;

  if (options.withPhoto) {
    const upload = await page.request.put(`/api/admin/users/${customer.id}/avatar`, {
      headers,
      multipart: { avatar: { name: 'photo.png', mimeType: 'image/png', buffer: await photoPng() } },
    });
    expect(upload.status(), await upload.text()).toBe(200);
  }

  return {
    id: customer.id,
    email: String(body.email),
    phone: String(body.phone),
    password: String(body.password),
    fullName: String(body.fullName),
    qrUrl: customer.qr.url,
  };
}

/** The most recent OTP sent to an email address or E.164 phone number. */
export async function latestOtpFor(recipient: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      () => {
        const lines = readFileSync(E2E.outboxFile, 'utf8').trim().split('\n').filter(Boolean);
        const messages = lines.map((l) => JSON.parse(l) as { to: string; text: string });
        const match = messages.reverse().find((m) => m.to === recipient);
        code = match ? /\b(\d{6})\b/.exec(match.text)?.[1] : undefined;
        return code;
      },
      { message: `waiting for an OTP to ${recipient}` },
    )
    .toBeDefined();
  return code!;
}

/**
 * A browser context with no cookies at all. `browser.newContext()` inside a test inherits
 * the file's `test.use({ storageState })`, so a "stranger" must be created explicitly.
 */
export function anonymousContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}

/**
 * The form control whose label is exactly `text`. Required labels end with a visual " *"
 * (hidden from screen readers but still part of the label text), so it is allowed here.
 */
export function field(page: Page, text: string): Locator {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.getByLabel(new RegExp(`^${escaped}( \\*)?$`));
}

/** Signs in through the login form. */
export async function signIn(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/login');
  await field(page, 'Email hoặc số điện thoại').fill(identifier);
  await field(page, 'Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

export async function apiGet(request: APIRequestContext, path: string) {
  return request.get(path);
}
