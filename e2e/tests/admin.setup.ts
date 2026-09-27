import { expect, test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { E2E } from '../support/config.js';
import { field, signIn } from '../support/helpers.js';

setup('admin signs in the first time and must replace the default password', async ({ page }) => {
  await signIn(page, E2E.admin.email, E2E.admin.initialPassword);

  // Forced first-login password change (spec §6).
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByText('Vui lòng đổi mật khẩu mặc định')).toBeVisible();
  await field(page, 'Mật khẩu mặc định').fill(E2E.admin.initialPassword);
  await field(page, 'Mật khẩu mới').fill(E2E.admin.password);
  await field(page, 'Nhập lại mật khẩu mới').fill(E2E.admin.password);
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();

  mkdirSync(dirname(E2E.adminStorageState), { recursive: true });
  await page.context().storageState({ path: E2E.adminStorageState });
});
