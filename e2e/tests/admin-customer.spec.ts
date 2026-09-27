import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { E2E } from '../support/config.js';
import { field, decodeQr, photoPng, randomMobile, uniqueSuffix } from '../support/helpers.js';

test.use({ storageState: E2E.adminStorageState });

test('admin creates a customer with a photo and gets a printable QR code (spec §5)', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const fullName = `Trần Thị Hạnh ${suffix}`;
  const phone = randomMobile();

  await page.goto('/admin/users');
  await page.getByRole('link', { name: 'Thêm khách hàng' }).first().click();
  await expect(page.getByRole('heading', { name: 'Thêm khách hàng' })).toBeVisible();

  await field(page, 'Họ và tên').fill(fullName);
  await field(page, 'Ngày sinh').fill('1948-11-02');
  await field(page, 'Giới tính').selectOption('FEMALE');
  await field(page, 'Địa chỉ').fill('27 Nguyễn Trãi, Phường 2, Quận 5');
  await field(page, 'SĐT gia đình').fill('0912 888 777');
  await field(page, 'Nhóm máu').selectOption('AB+');
  await field(page, 'Cân nặng (kg)').fill('46,5');
  await field(page, 'Chiều cao (cm)').fill('150');
  await page.getByTestId('avatar-input').setInputFiles({
    name: 'hanh.png',
    mimeType: 'image/png',
    buffer: await photoPng(),
  });
  await expect(page.getByRole('img', { name: `Ảnh đại diện của ${fullName}` })).toBeVisible();
  await field(page, 'Số điện thoại di động').fill(phone);
  await page.getByLabel(/đã được giải thích và đồng ý/).check();
  await page.getByRole('button', { name: 'Tạo khách hàng' }).click();

  // Detail page: the one-time temporary password.
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  const temporaryPassword = await field(page, 'Mật khẩu tạm').textContent();
  expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  await expect(page.getByText('Đang dùng mật khẩu tạm')).toBeVisible();
  await expect(page.getByText('Tuổi', { exact: true })).toBeVisible();

  // The uploaded photo is served back.
  const avatar = page.getByRole('img', { name: `Ảnh đại diện của ${fullName}` });
  await expect(avatar).toBeVisible();
  // Wait until the image has actually loaded, not just until the <img> exists.
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(512);

  // Shown once only: gone after a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(field(page, 'Mật khẩu tạm')).toHaveCount(0);

  // QR management: link, PNG download that really encodes that link.
  await page.getByRole('link', { name: 'Quản lý mã QR' }).click();
  await expect(page.getByRole('heading', { name: 'Mã QR', exact: true })).toBeVisible();
  const url = (await page.getByText(`${E2E.webUrl}/qr/`).textContent())!.trim();
  expect(url).toMatch(new RegExp(`^${E2E.webUrl}/qr/[A-Za-z0-9_-]{22}$`));

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Tải PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^qrcare-tran-thi-hanh-\d+\.png$/);
  const decoded = await decodeQr(readFileSync(await download.path()));
  expect(decoded).toBe(url);

  // The new customer is listed with an active QR.
  await page.goto('/admin/users');
  await field(page, 'Tìm kiếm').fill(`tran thi hanh ${suffix}`);
  await expect(page.getByRole('row', { name: new RegExp(fullName) })).toContainText('Có QR');
});
