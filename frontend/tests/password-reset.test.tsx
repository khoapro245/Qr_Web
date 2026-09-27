import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

const RESET_TOKEN = 'r'.repeat(43);

describe('password recovery', () => {
  it('goes from the login page through code and new password back to login', async () => {
    const bodies: Record<string, unknown> = {};
    server.use(
      http.post('/api/auth/forgot-password', async ({ request }) => {
        bodies.forgot = await request.json();
        return apiOk({ accepted: true });
      }),
      http.post('/api/auth/verify-otp', async ({ request }) => {
        bodies.verify = await request.json();
        return apiOk({ resetToken: RESET_TOKEN });
      }),
      http.post('/api/auth/reset-password', async ({ request }) => {
        bodies.reset = await request.json();
        return apiOk(null);
      }),
    );

    const { user, router } = renderApp('/login');
    await user.click(await screen.findByRole('link', { name: 'Quên mật khẩu?' }));
    // Wait for the lazily-loaded page: the login page has an identically labelled field.
    await screen.findByRole('heading', { name: 'Quên mật khẩu' });
    await user.type(screen.getByLabelText(/Email hoặc số điện thoại/), '0912 345 678');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));

    // Worded so it never confirms that the account exists.
    expect(
      await screen.findByText(/đã được đăng ký, mã xác nhận 6 số đã được gửi/),
    ).toBeInTheDocument();
    expect(screen.getByText('0912 345 678')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi lại mã sau \d+ giây/ })).toBeDisabled();

    await user.type(screen.getByLabelText(/Mã xác nhận/), '123456');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await user.type(await screen.findByLabelText(/^Mật khẩu mới/), 'Recovered2026');
    await user.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), 'Recovered2026');
    // The reset token is never put in the URL.
    expect(router.state.location.pathname).toBe('/reset-password');
    expect(router.state.location.search).toBe('');
    await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));

    expect(
      await screen.findByText('Đã đặt mật khẩu mới. Vui lòng đăng nhập bằng mật khẩu mới.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(bodies).toEqual({
      forgot: { identifier: '+84912345678' },
      verify: { identifier: '+84912345678', otp: '123456' },
      reset: { resetToken: RESET_TOKEN, newPassword: 'Recovered2026' },
    });
  });

  it('validates the code format and shows server rejections', async () => {
    server.use(
      http.post('/api/auth/forgot-password', () => apiOk({ accepted: true })),
      http.post('/api/auth/verify-otp', () => apiError(400, 'OTP_INVALID')),
    );
    const { user } = renderApp('/forgot-password');
    await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));

    await user.type(await screen.findByLabelText(/Mã xác nhận/), '12ab');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Mã xác nhận gồm 6 chữ số')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Mã xác nhận/));
    await user.type(screen.getByLabelText(/Mã xác nhận/), '000000');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mã xác nhận không đúng hoặc đã hết hạn.',
    );
  });

  it('explains when SMS recovery is not available', async () => {
    server.use(http.post('/api/auth/forgot-password', () => apiError(503, 'SMS_UNAVAILABLE')));
    const { user } = renderApp('/forgot-password');
    await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), '0912345678');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Khôi phục qua SMS hiện chưa');
  });

  it('sends visitors without a reset session back to the start', async () => {
    const { router } = renderApp('/reset-password');
    await waitFor(() => expect(router.state.location.pathname).toBe('/forgot-password'));
    expect(await screen.findByRole('heading', { name: 'Quên mật khẩu' })).toBeInTheDocument();
  });

  it('offers a new code when the reset session expired', async () => {
    server.use(
      http.post('/api/auth/forgot-password', () => apiOk({ accepted: true })),
      http.post('/api/auth/verify-otp', () => apiOk({ resetToken: RESET_TOKEN })),
      http.post('/api/auth/reset-password', () => apiError(400, 'RESET_TOKEN_INVALID')),
    );
    const { user } = renderApp('/forgot-password');
    await user.type(await screen.findByLabelText(/Email hoặc số điện thoại/), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));
    await user.type(await screen.findByLabelText(/Mã xác nhận/), '123456');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await user.type(await screen.findByLabelText(/^Mật khẩu mới/), 'Recovered2026');
    await user.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), 'Recovered2026');
    await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));

    expect(await screen.findByRole('link', { name: 'Yêu cầu mã mới' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
