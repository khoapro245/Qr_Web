import { expect, test } from '@playwright/test';
import { E2E } from '../support/config.js';
import { createCustomerViaApi, type CreatedCustomer } from '../support/helpers.js';

let customer: CreatedCustomer;

test.beforeAll(async ({ browser }) => {
  const admin = await browser.newContext({ storageState: E2E.adminStorageState });
  customer = await createCustomerViaApi(await admin.newPage(), {}, { withPhoto: true });
  await admin.close();
});

// A stranger scanning the shirt: brand-new browser, never signed in.
test('a stranger sees only the permitted profile, without logging in (spec §13, §20)', async ({
  page,
}) => {
  await page.goto(customer.qrUrl);

  await expect(page.getByRole('heading', { name: customer.fullName })).toBeVisible();
  for (const text of [
    '15/06/1950',
    'Nữ',
    '12 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    'B+',
    '50,5 kg',
    '155 cm',
  ]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/\d+ tuổi/)).toBeVisible();
  await expect(page.getByRole('link', { name: '0912 888 777' })).toHaveAttribute(
    'href',
    'tel:+84912888777',
  );

  const photo = page.getByRole('img', { name: `Ảnh đại diện của ${customer.fullName}` });
  await expect(photo).toBeVisible();
  // Wait until the image has actually loaded, not just until the <img> exists.
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(512);

  // Nothing private, and no way into the rest of the app.
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(customer.email);
  expect(body).not.toContain(customer.phone.slice(-6));
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByText(/đăng nhập/i)).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);

  // Kept out of search engines and browser history titles.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page).toHaveTitle('Thông tin hỗ trợ · QR Care');
});

test('the public API sends privacy headers and only whitelisted fields', async ({ request }) => {
  const token = customer.qrUrl.split('/qr/')[1]!;
  const res = await request.get(`/api/qr/${token}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  expect(res.headers()['cache-control']).toBe('no-store');
  const { profile } = (await res.json()).data as { profile: Record<string, unknown> };
  expect(Object.keys(profile).sort()).toEqual(
    [
      'address',
      'age',
      'avatarUrl',
      'bloodGroup',
      'dateOfBirth',
      'familyPhone',
      'fullName',
      'gender',
      'heightCm',
      'weightKg',
    ].sort(),
  );
});

test('an unknown code shows a clear message and emergency numbers', async ({ page }) => {
  await page.goto('/qr/AAAAAAAAAAAAAAAAAAAAAA');
  await expect(
    page.getByRole('heading', { name: 'Mã QR không hợp lệ hoặc đã bị thu hồi' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '115' })).toHaveAttribute('href', 'tel:115');
});
