import { expect, test, type Browser } from '@playwright/test';
import { E2E } from '../support/config.js';
import { anonymousContext, createCustomerViaApi, signIn } from '../support/helpers.js';

test.use({ storageState: E2E.adminStorageState });

/** Opens a QR link in a separate, anonymous browser — like a phone scanning the shirt. */
async function scan(browser: Browser, url: string): Promise<'profile' | 'unavailable'> {
  const context = await anonymousContext(browser);
  const page = await context.newPage();
  await page.goto(url);
  const profile = page.getByRole('article');
  const unavailable = page.getByRole('heading', { name: 'Mã QR không hợp lệ hoặc đã bị thu hồi' });
  await expect(profile.or(unavailable)).toBeVisible();
  const result = (await profile.isVisible()) ? 'profile' : 'unavailable';
  await context.close();
  return result;
}

test('regenerating a QR code stops the old shirt link immediately (spec §11)', async ({
  page,
  browser,
}) => {
  const customer = await createCustomerViaApi(page);
  expect(await scan(browser, customer.qrUrl)).toBe('profile');

  await page.goto(`/admin/users/${customer.id}/qr`);
  await page.getByRole('button', { name: 'Tạo lại mã QR' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lại mã QR?' });
  await expect(dialog).toContainText('ngừng hoạt động ngay lập tức');
  await dialog.getByRole('button', { name: 'Tạo mã mới' }).click();

  const newUrlLocator = page.getByText(`${E2E.webUrl}/qr/`);
  await expect(newUrlLocator).not.toHaveText(customer.qrUrl);
  const newUrl = (await newUrlLocator.textContent())!.trim();
  await expect(page.getByText('Đã thu hồi')).toBeVisible();

  expect(await scan(browser, customer.qrUrl)).toBe('unavailable');
  expect(await scan(browser, newUrl)).toBe('profile');
});

test('deactivating a customer hides the profile and blocks login; reactivating restores both (spec §12, §15)', async ({
  page,
  browser,
}) => {
  const customer = await createCustomerViaApi(page);

  await page.goto(`/admin/users/${customer.id}`);
  await page.getByRole('button', { name: 'Vô hiệu hóa' }).click();
  await page
    .getByRole('dialog', { name: 'Vô hiệu hóa khách hàng?' })
    .getByRole('button', { name: 'Vô hiệu hóa' })
    .click();
  await expect(page.getByText('Tài khoản đang bị vô hiệu hóa')).toBeVisible();

  expect(await scan(browser, customer.qrUrl)).toBe('unavailable');

  const customerContext = await anonymousContext(browser);
  const customerPage = await customerContext.newPage();
  await signIn(customerPage, customer.email, customer.password);
  await expect(customerPage.getByRole('alert')).toContainText('Tài khoản này đã bị vô hiệu hóa');

  await page.getByRole('button', { name: 'Kích hoạt lại' }).click();
  await page
    .getByRole('dialog', { name: 'Kích hoạt lại khách hàng?' })
    .getByRole('button', { name: 'Kích hoạt lại' })
    .click();
  await expect(page.getByText('Tài khoản đang bị vô hiệu hóa')).toHaveCount(0);

  expect(await scan(browser, customer.qrUrl)).toBe('profile');
  await signIn(customerPage, customer.email, customer.password);
  await expect(customerPage).toHaveURL(/\/change-password$/);
  await customerContext.close();
});
