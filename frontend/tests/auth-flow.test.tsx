import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  adminUser as admin,
  customerUser as customer,
  dashboardReturns,
  ownProfile,
  signedInAs,
  stats,
} from './fixtures';
import { apiError, apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

describe('authentication flows', () => {
  it('sends anonymous visitors of admin pages to the login page', async () => {
    const { router } = renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('validates the login form before calling the API', async () => {
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Vui lòng nhập email hoặc số điện thoại')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Email hoặc số điện thoại/), 'abc');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Email hoặc số điện thoại không hợp lệ')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email hoặc số điện thoại/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('logs in with a phone number and opens the admin dashboard', async () => {
    let sentBody: unknown;
    let sentCsrf: string | null = null;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        sentBody = await request.json();
        sentCsrf = request.headers.get('X-CSRF-Token');
        signedInAs(admin);
        return apiOk({ user: admin });
      }),
    );
    dashboardReturns(stats);

    const { user, router } = renderApp('/login');
    await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), '0912 345 678');
    await user.type(screen.getByLabelText(/^Mật khẩu/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(sentBody).toEqual({ identifier: '+84912345678', password: 'Password123' });
    expect(sentCsrf).toBe('test-csrf');
  });

  it('shows a friendly message for wrong credentials', async () => {
    server.use(http.post('/api/auth/login', () => apiError(401, 'INVALID_CREDENTIALS')));
    const { user } = renderApp('/login');
    await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), 'a@example.com');
    await user.type(screen.getByLabelText(/^Mật khẩu/), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email/số điện thoại hoặc mật khẩu không đúng.',
    );
  });

  it('shows how long a locked account must wait', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        apiError(423, 'ACCOUNT_LOCKED', { retryAfterSeconds: 600 }),
      ),
    );
    const { user } = renderApp('/login');
    await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), 'a@example.com');
    await user.type(screen.getByLabelText(/^Mật khẩu/), 'whatever1');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('thử lại sau 10 phút');
  });

  it('forces a first-login password change, then continues to the dashboard', async () => {
    signedInAs({ ...admin, mustChangePassword: true });
    dashboardReturns(stats);
    let changeBody: unknown;
    server.use(
      http.post('/api/auth/change-password', async ({ request }) => {
        changeBody = await request.json();
        signedInAs(admin);
        return apiOk({ user: admin });
      }),
    );

    const { user, router } = renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Đổi mật khẩu' })).toBeInTheDocument();
    expect(screen.getByText('Vui lòng đổi mật khẩu mặc định')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Mật khẩu mặc định/), 'hT4k-9mQx-Rw2p');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'MyNewPass2024');
    await user.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), 'Different2024');
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));
    expect(await screen.findByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Nhập lại mật khẩu mới/));
    await user.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), 'MyNewPass2024');
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
    expect(changeBody).toEqual({
      currentPassword: 'hT4k-9mQx-Rw2p',
      newPassword: 'MyNewPass2024',
    });
  });

  it('shows the server message when the current password is wrong', async () => {
    signedInAs({ ...admin, mustChangePassword: true });
    server.use(
      http.post('/api/auth/change-password', () => apiError(400, 'INVALID_CURRENT_PASSWORD')),
    );
    const { user } = renderApp('/change-password');
    await user.type(await screen.findByLabelText(/Mật khẩu mặc định/), 'wrong-one1');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'MyNewPass2024');
    await user.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), 'MyNewPass2024');
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));
    expect(await screen.findByText('Mật khẩu hiện tại không đúng.')).toBeInTheDocument();
  });

  it('keeps customers out of admin pages', async () => {
    signedInAs(customer);
    server.use(http.get('/api/me/profile', () => apiOk(ownProfile)));
    const { router } = renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Hồ sơ của tôi' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('returns to the login page when the session cannot be refreshed', async () => {
    signedInAs(admin);
    let refreshCalls = 0;
    server.use(
      http.get('/api/admin/dashboard', () => apiError(401, 'UNAUTHENTICATED')),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return apiError(401, 'SESSION_EXPIRED');
      }),
    );
    const { router } = renderApp('/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(refreshCalls).toBe(1);
  });

  it('retries the request after a successful silent refresh', async () => {
    signedInAs(admin);
    let dashboardCalls = 0;
    server.use(
      http.get('/api/admin/dashboard', () => {
        dashboardCalls += 1;
        return dashboardCalls === 1
          ? apiError(401, 'UNAUTHENTICATED')
          : apiOk({ stats, recentCustomers: [] });
      }),
      http.post('/api/auth/refresh', () => apiOk(null)),
    );
    renderApp('/admin');
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(dashboardCalls).toBe(2);
  });
});
