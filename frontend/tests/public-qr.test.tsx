import type { PublicProfile } from '@qrcare/shared';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

const token = 'AbCdEfGhIjKlMnOpQrStUv';

const profile: PublicProfile = {
  fullName: 'Nguyễn Văn A',
  dateOfBirth: '2006-03-19',
  age: 20,
  gender: 'MALE',
  address: '12 Lê Lợi, Quận 1, TP.HCM',
  familyPhone: '+84987654321',
  bloodGroup: 'O+',
  weightKg: 60,
  heightCm: 170,
  avatarUrl: `/api/qr/${token}/avatar?v=abc123def456`,
};

describe('public QR page', () => {
  it('shows the permitted profile without requiring a login', async () => {
    let meCalls = 0;
    server.use(
      http.get(`/api/qr/${token}`, () => apiOk({ profile })),
      http.get('/api/auth/me', () => {
        meCalls += 1;
        return apiError(401, 'UNAUTHENTICATED');
      }),
    );
    const { router } = renderApp(`/qr/${token}`);

    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/qr/${token}`);
    expect(screen.getByText('19/03/2006')).toBeInTheDocument();
    expect(screen.getByText('20 tuổi')).toBeInTheDocument();
    expect(screen.getByText('Nam')).toBeInTheDocument();
    expect(screen.getByText('12 Lê Lợi, Quận 1, TP.HCM')).toBeInTheDocument();
    expect(screen.getByText('O+')).toBeInTheDocument();
    expect(screen.getByText('60 kg')).toBeInTheDocument();
    expect(screen.getByText('170 cm')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ảnh đại diện của Nguyễn Văn A' })).toHaveAttribute(
      'src',
      profile.avatarUrl,
    );
    // The family phone is tappable on a phone.
    expect(screen.getByRole('link', { name: '0987 654 321' })).toHaveAttribute(
      'href',
      'tel:+84987654321',
    );
    // A public visitor is never asked who they are.
    expect(meCalls).toBe(0);
    expect(document.title).toBe('Thông tin hỗ trợ · QR Care');
  });

  it('offers no login, navigation or search', async () => {
    server.use(http.get(`/api/qr/${token}`, () => apiOk({ profile })));
    renderApp(`/qr/${token}`);
    await screen.findByRole('heading', { name: 'Nguyễn Văn A' });

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/đăng nhập/i)).toBeNull();
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['tel:+84987654321']);
  });

  it('hides optional fields that are empty and shows initials without a photo', async () => {
    server.use(
      http.get(`/api/qr/${token}`, () =>
        apiOk({ profile: { ...profile, address: null, weightKg: null, avatarUrl: null } }),
      ),
    );
    renderApp(`/qr/${token}`);
    await screen.findByRole('heading', { name: 'Nguyễn Văn A' });
    expect(screen.queryByText('Địa chỉ')).toBeNull();
    expect(screen.queryByText('Cân nặng')).toBeNull();
    expect(screen.getByRole('img', { name: /chưa có ảnh đại diện/ })).toBeInTheDocument();
  });

  it('explains invalid or revoked codes and shows emergency numbers', async () => {
    server.use(http.get(`/api/qr/${token}`, () => apiError(404, 'QR_NOT_FOUND')));
    renderApp(`/qr/${token}`);
    expect(
      await screen.findByRole('heading', { name: 'Mã QR không hợp lệ hoặc đã bị thu hồi' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '115' })).toHaveAttribute('href', 'tel:115');
    expect(screen.getByRole('link', { name: '113' })).toHaveAttribute('href', 'tel:113');
  });

  it('rejects malformed tokens without calling the API', async () => {
    let calls = 0;
    server.use(
      http.get('/api/qr/:token', () => {
        calls += 1;
        return apiOk({ profile });
      }),
    );
    renderApp('/qr/not-a-token');
    expect(
      await screen.findByRole('heading', { name: 'Mã QR không hợp lệ hoặc đã bị thu hồi' }),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('lets the visitor retry after a network failure', async () => {
    let attempts = 0;
    server.use(
      http.get(`/api/qr/${token}`, () => {
        attempts += 1;
        return attempts <= 3 ? HttpResponse.error() : apiOk({ profile });
      }),
    );
    const { user } = renderApp(`/qr/${token}`);
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }, { timeout: 8000 }));
    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();
  });
});
