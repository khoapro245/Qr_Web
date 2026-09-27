import { screen } from '@testing-library/react';
import axe from 'axe-core';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  adminUser,
  customerDetail,
  customerSummary,
  customerUser,
  dashboardReturns,
  ownProfile,
  signedInAs,
  stats,
  withAvatar,
} from './fixtures';
import { apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

/**
 * Automated WCAG 2.x A/AA + best-practice checks with axe-core. Colour contrast cannot be
 * computed in jsdom; it is verified in a real browser (see docs/testing notes).
 */
async function expectNoA11yViolations() {
  const results = await axe.run(document.body, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}

describe('accessibility (axe-core)', () => {
  it('login page', async () => {
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Đăng nhập' });
    await expectNoA11yViolations();
  });

  it('forgot password page', async () => {
    renderApp('/forgot-password');
    await screen.findByRole('heading', { name: 'Quên mật khẩu' });
    await expectNoA11yViolations();
  });

  it('public QR page', async () => {
    server.use(
      http.get('/api/qr/:token', () =>
        apiOk({
          profile: {
            ...ownProfile.profile,
            avatarUrl: '/api/qr/AbCdEfGhIjKlMnOpQrStUv/avatar?v=1',
          },
        }),
      ),
    );
    renderApp('/qr/AbCdEfGhIjKlMnOpQrStUv');
    await screen.findByRole('heading', { name: 'Nguyễn Văn A' });
    await expectNoA11yViolations();
  });

  it('admin dashboard', async () => {
    signedInAs(adminUser);
    dashboardReturns(stats);
    renderApp('/admin');
    await screen.findByText('12');
    await expectNoA11yViolations();
  });

  it('customer list', async () => {
    signedInAs(adminUser);
    server.use(
      http.get('/api/admin/users', () =>
        apiOk({ items: [customerSummary], page: 1, pageSize: 20, total: 1 }),
      ),
    );
    renderApp('/admin/users');
    await screen.findByRole('table');
    await expectNoA11yViolations();
  });

  it('customer creation form with validation errors', async () => {
    signedInAs(adminUser);
    const { user } = renderApp('/admin/users/create');
    await user.click(await screen.findByRole('button', { name: 'Tạo khách hàng' }));
    await screen.findByText('Vui lòng nhập họ tên');
    await expectNoA11yViolations();
  });

  it('customer detail with a confirmation dialog open', async () => {
    signedInAs(adminUser);
    server.use(
      http.get(`/api/admin/users/${customerDetail.id}`, () =>
        apiOk({ customer: withAvatar(customerDetail) }),
      ),
    );
    const { user } = renderApp(`/admin/users/${customerDetail.id}`);
    await user.click(await screen.findByRole('button', { name: 'Vô hiệu hóa' }));
    await screen.findByRole('dialog');
    await expectNoA11yViolations();
  });

  it('QR management page', async () => {
    signedInAs(adminUser);
    server.use(
      http.get(`/api/admin/users/${customerDetail.id}`, () => apiOk({ customer: customerDetail })),
      http.get(`/api/admin/users/${customerDetail.id}/qr`, () =>
        apiOk({ current: customerDetail.qr, history: [customerDetail.qr] }),
      ),
    );
    renderApp(`/admin/users/${customerDetail.id}/qr`);
    await screen.findByRole('table');
    await expectNoA11yViolations();
  });

  it('customer profile in edit mode', async () => {
    signedInAs(customerUser);
    server.use(http.get('/api/me/profile', () => apiOk(ownProfile)));
    const { user } = renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    await screen.findByRole('button', { name: 'Lưu thay đổi' });
    await expectNoA11yViolations();
  });
});
