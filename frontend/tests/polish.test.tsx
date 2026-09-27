import { render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RouteErrorPage } from '../src/pages/RouteErrorPage';
import { adminUser, dashboardReturns, signedInAs, stats } from './fixtures';
import { apiError, server } from './msw/server';
import { renderApp } from './utils/render';

function renderThrowing(error: Error) {
  const Thrower = () => {
    throw error;
  };
  const router = createMemoryRouter([
    { path: '/', element: <Thrower />, errorElement: <RouteErrorPage /> },
  ]);
  render(<RouterProvider router={router} />);
}

describe('error screen', () => {
  it('asks for a reload when a new release removed the old page files', async () => {
    renderThrowing(
      new TypeError('Failed to fetch dynamically imported module: /assets/CustomersPage-x.js'),
    );
    expect(
      await screen.findByRole('heading', { name: 'Ứng dụng vừa được cập nhật' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeInTheDocument();
  });

  it('shows a friendly message for unexpected errors', async () => {
    renderThrowing(new Error('boom'));
    expect(await screen.findByRole('heading', { name: 'Đã có lỗi xảy ra' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('boom')).toBeNull();
  });
});

describe('session end notice', () => {
  it('tells a signed-in user that the session expired', async () => {
    signedInAs(adminUser);
    server.use(http.get('/api/admin/dashboard', () => apiError(401, 'UNAUTHENTICATED')));
    renderApp('/admin');
    expect(
      await screen.findByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'),
    ).toBeInTheDocument();
  });

  it('explains a deactivated account', async () => {
    signedInAs(adminUser);
    server.use(http.get('/api/admin/dashboard', () => apiError(401, 'ACCOUNT_INACTIVE')));
    renderApp('/admin');
    expect(
      await screen.findByText('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ nhà sản xuất.'),
    ).toBeInTheDocument();
  });

  it('says nothing to a visitor who was never signed in', async () => {
    renderApp('/admin');
    await screen.findByRole('heading', { name: 'Đăng nhập' });
    expect(screen.queryByText(/Phiên đăng nhập đã hết hạn/)).toBeNull();
  });
});

describe('navigation', () => {
  it('closes the mobile menu with Escape and returns focus to its button', async () => {
    signedInAs(adminUser);
    dashboardReturns(stats);
    const { user } = renderApp('/admin');
    const toggle = await screen.findByRole('button', { name: 'Mở menu' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    const closed = screen.getByRole('button', { name: 'Mở menu' });
    expect(closed).toHaveAttribute('aria-expanded', 'false');
    expect(closed).toHaveFocus();
  });

  it('announces the new page to screen readers after navigation', async () => {
    signedInAs(adminUser);
    dashboardReturns(stats);
    server.use(
      http.get('/api/admin/users', () =>
        Response.json({ success: true, data: { items: [], page: 1, pageSize: 20, total: 0 } }),
      ),
    );
    const { user } = renderApp('/admin');
    await screen.findByText('12');
    const [navLink] = screen.getAllByRole('link', { name: 'Khách hàng' });
    await user.click(navLink!);
    await waitFor(() =>
      expect(screen.getByText('Đã chuyển tới trang Khách hàng')).toBeInTheDocument(),
    );
  });
});
