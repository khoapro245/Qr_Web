import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  adminUser,
  customerDetail,
  customerSummary,
  customerUser,
  dashboardReturns,
  ownProfile,
  signedInAs,
  stats,
} from './fixtures';
import { apiError, apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

const detailUrl = `/api/admin/users/${customerDetail.id}`;

describe('admin: edit customer', () => {
  it('pre-fills the form and saves normalised changes', async () => {
    signedInAs(adminUser);
    let body: unknown;
    server.use(
      http.get(detailUrl, () => apiOk({ customer: customerDetail })),
      http.put(detailUrl, async ({ request }) => {
        body = await request.json();
        return apiOk({
          customer: {
            ...customerDetail,
            account: { ...customerDetail.account, phone: '+84988777666' },
          },
        });
      }),
    );

    const { user, router } = renderApp(`/admin/users/${customerDetail.id}/edit`);
    expect(await screen.findByLabelText(/Họ và tên/)).toHaveValue('Nguyễn Văn A');
    expect(screen.getByLabelText(/SĐT gia đình/)).toHaveValue('0987 654 321');
    expect(screen.getByLabelText(/^Số điện thoại di động/)).toHaveValue('0912 345 678');
    expect(screen.getByLabelText(/Cân nặng/)).toHaveValue('60.5');

    const phone = screen.getByLabelText(/^Số điện thoại di động/);
    await user.clear(phone);
    await user.type(phone, '0988 777 666');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/admin/users/${customerDetail.id}`),
    );
    expect(body).toMatchObject({
      fullName: 'Nguyễn Văn A',
      phone: '+84988777666',
      email: 'khach@example.com',
      familyPhone: '+84987654321',
      weightKg: 60.5,
    });
  });

  it('shows a duplicate phone next to the field', async () => {
    signedInAs(adminUser);
    server.use(
      http.get(detailUrl, () => apiOk({ customer: customerDetail })),
      http.put(detailUrl, () =>
        apiError(409, 'PHONE_TAKEN', [
          { path: 'phone', message: 'Số điện thoại này đã được dùng cho tài khoản khác' },
        ]),
      ),
    );
    const { user } = renderApp(`/admin/users/${customerDetail.id}/edit`);
    await user.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));
    expect(
      await screen.findByText('Số điện thoại này đã được dùng cho tài khoản khác'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Số điện thoại di động/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks saving without any login identifier', async () => {
    signedInAs(adminUser);
    server.use(http.get(detailUrl, () => apiOk({ customer: customerDetail })));
    const { user } = renderApp(`/admin/users/${customerDetail.id}/edit`);
    await user.clear(await screen.findByLabelText(/^Email/));
    await user.clear(screen.getByLabelText(/^Số điện thoại di động/));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(
      await screen.findByText('Cần ít nhất email hoặc số điện thoại để khách hàng đăng nhập'),
    ).toBeInTheDocument();
  });
});

describe('admin: other flows', () => {
  it('pages through the customer list', async () => {
    signedInAs(adminUser);
    const pages: string[] = [];
    server.use(
      http.get('/api/admin/users', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        pages.push(page);
        return apiOk({
          items: [{ ...customerSummary, fullName: `Khách trang ${page}` }],
          page: Number(page),
          pageSize: 20,
          total: 45,
        });
      }),
    );
    const { user, router } = renderApp('/admin/users');
    expect((await screen.findAllByText('Khách trang 1')).length).toBeGreaterThan(0);
    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sau' }));
    expect((await screen.findAllByText('Khách trang 2')).length).toBeGreaterThan(0);
    expect(router.state.location.search).toBe('?page=2');
    expect(pages).toContain('2');
  });

  it('issues a new temporary password after confirmation and lets it be copied', async () => {
    signedInAs(adminUser);
    server.use(
      http.get(detailUrl, () => apiOk({ customer: customerDetail })),
      http.post(`${detailUrl}/reset-password`, () =>
        apiOk({ temporaryPassword: 'Ab3d-Ef4h-Jk5m' }),
      ),
    );
    const { user } = renderApp(`/admin/users/${customerDetail.id}`);
    await user.click(await screen.findByRole('button', { name: 'Cấp lại mật khẩu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cấp lại mật khẩu?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cấp mật khẩu mới' }));

    expect(await screen.findByText('Ab3d-Ef4h-Jk5m')).toBeInTheDocument();
    expect(screen.getByText('Đã cấp lại mật khẩu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sao chép' }));
    expect(await screen.findByText('Đã sao chép')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('Ab3d-Ef4h-Jk5m');
  });

  it('signs out and forgets cached data', async () => {
    signedInAs(adminUser);
    dashboardReturns(stats);
    let loggedOut = false;
    server.use(
      http.post('/api/auth/logout', () => {
        loggedOut = true;
        return apiOk(null);
      }),
    );
    const { user, router } = renderApp('/admin');
    await screen.findByText('12');
    const [logoutButton] = screen.getAllByRole('button', { name: 'Đăng xuất' });
    await user.click(logoutButton!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(loggedOut).toBe(true);
  });
});

describe('routing', () => {
  it('sends the home page to the right area for each role', async () => {
    signedInAs(customerUser);
    server.use(http.get('/api/me/profile', () => apiOk(ownProfile)));
    const { router } = renderApp('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });

  it('sends anonymous visitors of the home page to login', async () => {
    const { router } = renderApp('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('shows a not-found page for unknown addresses', async () => {
    renderApp('/khong-ton-tai');
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy trang' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
  });
});

describe('password recovery: resend', () => {
  it('lets the code be resent after the cooldown', async () => {
    // Fake clock so the 60-second cooldown takes milliseconds; real time still flows for
    // network mocks and user-event.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let requests = 0;
      server.use(
        http.post('/api/auth/forgot-password', () => {
          requests += 1;
          return apiOk({ accepted: true });
        }),
      );
      const { user } = renderApp('/forgot-password');
      await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), 'a@example.com');
      await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));

      expect(await screen.findByRole('button', { name: /Gửi lại mã sau/ })).toBeDisabled();
      for (let second = 0; second < 61; second++) {
        await act(() => vi.advanceTimersByTimeAsync(1000));
      }
      await user.click(screen.getByRole('button', { name: 'Gửi lại mã' }));
      expect(
        await screen.findByText('Đã gửi lại mã xác nhận. Mã cũ không còn dùng được.'),
      ).toBeInTheDocument();
      expect(requests).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
