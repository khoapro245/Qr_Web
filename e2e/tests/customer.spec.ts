import { expect, test } from '@playwright/test';
import { E2E } from '../support/config.js';
import {
  anonymousContext,
  createCustomerViaApi,
  field,
  signIn,
  type CreatedCustomer,
} from '../support/helpers.js';

let customer: CreatedCustomer;

test.beforeAll(async ({ browser }) => {
  const admin = await browser.newContext({ storageState: E2E.adminStorageState });
  customer = await createCustomerViaApi(await admin.newPage(), {}, { withPhoto: true });
  await admin.close();
});

test('a customer replaces the default password, edits the profile and stays out of admin (spec §2.2, §27)', async ({
  page,
}) => {
  // Login by phone number, written the way people type it.
  const localPhone = `0${customer.phone.slice(1, 4)} ${customer.phone.slice(4, 7)} ${customer.phone.slice(7)}`;
  await signIn(page, localPhone, customer.password);

  await expect(page).toHaveURL(/\/change-password$/);
  await field(page, 'Mật khẩu mặc định').fill(customer.password);
  await field(page, 'Mật khẩu mới').fill('Khach-Moi-2026');
  await field(page, 'Nhập lại mật khẩu mới').fill('Khach-Moi-2026');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi' })).toBeVisible();
  await expect(page.getByText(/Ảnh đại diện do nhà sản xuất quản lý/)).toBeVisible();
  await expect(
    page.getByRole('img', { name: `Ảnh đại diện của ${customer.fullName}` }),
  ).toBeVisible();
  // No way to change the photo.
  await expect(page.locator('input[type="file"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click();
  await field(page, 'Địa chỉ').fill('45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội');
  await field(page, 'Cân nặng (kg)').fill('52');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi hồ sơ.')).toBeVisible();
  await expect(page.getByText('45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội')).toBeVisible();
  await expect(page.getByText('52 kg')).toBeVisible();

  // The public QR page shows the customer's own edits.
  const stranger = await anonymousContext(page.context().browser()!);
  const publicPage = await stranger.newPage();
  await publicPage.goto(customer.qrUrl);
  await expect(publicPage.getByText('45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội')).toBeVisible();
  await stranger.close();

  // Admin pages are off-limits in the browser and at the API.
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/profile$/);
  const api = await page.request.get('/api/admin/users');
  expect(api.status()).toBe(403);

  // Sign out.
  await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/me/profile')).status()).toBe(401);
});
