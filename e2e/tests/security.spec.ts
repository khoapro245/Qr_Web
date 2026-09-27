import { expect, test } from '@playwright/test';
import { E2E } from '../support/config.js';
import { anonymousContext, createCustomerViaApi, field, signIn } from '../support/helpers.js';

test.use({ storageState: E2E.adminStorageState });

test('stored script in profile fields is shown as text and never runs', async ({
  page,
  browser,
}) => {
  const payload = '<img src=x onerror=alert("xss")><script>alert("xss")</script>';
  const customer = await createCustomerViaApi(page, {
    fullName: payload,
    address: '"><svg onload=alert("xss")>',
  });

  const dialogs: string[] = [];
  const csp: string[] = [];
  const watch = (p: typeof page) => {
    p.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    p.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) csp.push(message.text());
    });
  };
  watch(page);

  for (const path of [
    '/admin',
    '/admin/users',
    `/admin/users/${customer.id}`,
    `/admin/users/${customer.id}/qr`,
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await expect(page.getByText(payload).first()).toBeVisible();

  const strangerContext = await anonymousContext(browser);
  const stranger = await strangerContext.newPage();
  watch(stranger);
  await stranger.goto(customer.qrUrl);
  await expect(stranger.getByRole('heading', { name: payload })).toBeVisible();
  await expect(stranger.getByText('"><svg onload=alert("xss")>')).toBeVisible();
  await strangerContext.close();

  expect(dialogs).toEqual([]);
  expect(csp).toEqual([]);
});

test('the production build ships a strict Content-Security-Policy', async ({ page }) => {
  await page.goto('/login');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("object-src 'none'");
});

test('a signed-in customer cannot reach admin data by calling the API directly', async ({
  page,
  browser,
}) => {
  const victim = await createCustomerViaApi(page);
  const attacker = await createCustomerViaApi(page);

  // The attacker is a real, fully set-up customer (password already changed).
  const context = await anonymousContext(browser);
  const attackerPage = await context.newPage();
  await signIn(attackerPage, attacker.email, attacker.password);
  await field(attackerPage, 'Mật khẩu mặc định').fill(attacker.password);
  await field(attackerPage, 'Mật khẩu mới').fill('Attacker-New-2026');
  await field(attackerPage, 'Nhập lại mật khẩu mới').fill('Attacker-New-2026');
  await attackerPage.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(attackerPage).toHaveURL(/\/profile$/);

  for (const path of [
    '/api/admin/users',
    `/api/admin/users/${victim.id}`,
    `/api/admin/users/${victim.id}/qr`,
    `/api/admin/users/${victim.id}/avatar`,
  ]) {
    const res = await attackerPage.request.get(path);
    expect(res.status(), path).toBe(403);
    expect((await res.json()).code, path).toBe('FORBIDDEN');
  }
  await context.close();
});

test('pages are not framed or cached with personal data', async ({ request }) => {
  const res = await request.get('/api/admin/dashboard');
  expect(res.headers()['cache-control']).toBe('no-store');
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});
