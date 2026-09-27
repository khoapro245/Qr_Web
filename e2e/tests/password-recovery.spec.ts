import { expect, test } from '@playwright/test';
import { E2E } from '../support/config.js';
import { field, createCustomerViaApi, latestOtpFor, signIn } from '../support/helpers.js';

test('a customer recovers the password with an email OTP (spec §9)', async ({ page, browser }) => {
  const admin = await browser.newContext({ storageState: E2E.adminStorageState });
  const customer = await createCustomerViaApi(await admin.newPage());
  await admin.close();

  await page.goto('/login');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await field(page, 'Email hoặc số điện thoại').fill(customer.email);
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).click();

  await expect(page.getByText(/đã được đăng ký, mã xác nhận 6 số đã được gửi/)).toBeVisible();
  const code = await latestOtpFor(customer.email);

  // A wrong code is refused first.
  await field(page, 'Mã xác nhận').fill(code === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('alert')).toContainText('Mã xác nhận không đúng hoặc đã hết hạn.');

  await field(page, 'Mã xác nhận').fill(code);
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await field(page, 'Mật khẩu mới').fill('Da-Khoi-Phuc-2026');
  await field(page, 'Nhập lại mật khẩu mới').fill('Da-Khoi-Phuc-2026');
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Đã đặt mật khẩu mới.', { exact: false })).toBeVisible();

  // Old password no longer works; the new one does, with no forced change.
  await signIn(page, customer.email, customer.password);
  await expect(page.getByRole('alert')).toContainText('mật khẩu không đúng');
  await signIn(page, customer.email, 'Da-Khoi-Phuc-2026');
  await expect(page).toHaveURL(/\/profile$/);
});

test('recovery does not reveal whether an account exists', async ({ page }) => {
  await page.goto('/forgot-password');
  await field(page, 'Email hoặc số điện thoại').fill('khong-ton-tai@e2e.qrcare.test');
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).click();
  // Same next step as for a real account.
  await expect(page.getByText(/đã được đăng ký, mã xác nhận 6 số đã được gửi/)).toBeVisible();
});
