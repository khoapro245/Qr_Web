import type { CustomerQrInfo, QrCodeView } from '@qrcare/shared';
import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { adminUser, customerDetail, signedInAs } from './fixtures';
import { apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

const id = customerDetail.id;
const current = customerDetail.qr as QrCodeView;
const newCode: QrCodeView = {
  id: '55555555-5555-4555-8555-555555555555',
  status: 'ACTIVE',
  url: 'http://localhost:5173/qr/ZyXwVuTsRqPoNmLkJiHgFe',
  tokenHint: 'HgFe',
  createdAt: '2026-09-02T03:00:00.000Z',
  revokedAt: null,
};
const revokedOld: QrCodeView = {
  ...current,
  status: 'REVOKED',
  url: null,
  revokedAt: '2026-09-02T03:00:00.000Z',
};

/** A small stateful fake: mutations change what subsequent GETs return, like the server. */
function qrReturns(initial: CustomerQrInfo) {
  let state = initial;
  server.use(
    http.get(`/api/admin/users/${id}`, () => apiOk({ customer: customerDetail })),
    http.get(`/api/admin/users/${id}/qr`, () => apiOk(state)),
  );
  return {
    set(next: CustomerQrInfo) {
      state = next;
      return apiOk(next);
    },
  };
}

describe('QR management', () => {
  it('links from the customer detail page to QR management', async () => {
    signedInAs(adminUser);
    qrReturns({ current, history: [current] });
    const { user, router } = renderApp(`/admin/users/${id}`);

    const preview = await screen.findByRole('img', { name: 'Mã QR của Nguyễn Văn A' });
    expect(preview.getAttribute('src')).toContain(`/api/admin/users/${id}/qr/image?`);
    await user.click(screen.getByRole('link', { name: 'Quản lý mã QR' }));
    expect(router.state.location.pathname).toBe(`/admin/users/${id}/qr`);
  });

  it('shows the current code with its link, downloads and history', async () => {
    signedInAs(adminUser);
    qrReturns({ current, history: [current] });
    renderApp(`/admin/users/${id}/qr`);

    expect(await screen.findByText(current.url!)).toBeInTheDocument();
    const png = screen.getByRole('link', { name: 'Tải PNG' });
    expect(png).toHaveAttribute('download');
    expect(png.getAttribute('href')).toContain('format=png');
    expect(png.getAttribute('href')).toContain('download=1');
    expect(screen.getByRole('link', { name: 'Tải SVG (in ấn)' }).getAttribute('href')).toContain(
      'format=svg',
    );
    expect(screen.getByText('…StUv')).toBeInTheDocument();
  });

  it('copies the public link', async () => {
    signedInAs(adminUser);
    qrReturns({ current, history: [current] });

    // user-event installs its own in-memory clipboard on navigator.
    const { user } = renderApp(`/admin/users/${id}/qr`);
    await user.click(await screen.findByRole('button', { name: 'Sao chép đường dẫn' }));
    expect(await screen.findByText('Đã sao chép')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(current.url);
  });

  it('regenerates after a clear warning and shows the new link', async () => {
    signedInAs(adminUser);
    const fake = qrReturns({ current, history: [current] });
    let calls = 0;
    server.use(
      http.post(`/api/admin/users/${id}/qr/regenerate`, () => {
        calls += 1;
        return fake.set({ current: newCode, history: [newCode, revokedOld] });
      }),
    );

    const { user } = renderApp(`/admin/users/${id}/qr`);
    await user.click(await screen.findByRole('button', { name: 'Tạo lại mã QR' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tạo lại mã QR?' });
    expect(dialog).toHaveTextContent('ngừng hoạt động ngay lập tức');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo mã mới' }));

    expect(await screen.findByText(newCode.url!)).toBeInTheDocument();
    expect(screen.queryByText(current.url!)).toBeNull();
    expect(screen.getByText('Đã thu hồi')).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('revokes and can generate a new code afterwards', async () => {
    signedInAs(adminUser);
    const fake = qrReturns({ current, history: [current] });
    server.use(
      http.post(`/api/admin/users/${id}/qr/revoke`, () =>
        fake.set({ current: null, history: [revokedOld] }),
      ),
      http.post(`/api/admin/users/${id}/qr`, () =>
        fake.set({ current: newCode, history: [newCode, revokedOld] }),
      ),
    );

    const { user } = renderApp(`/admin/users/${id}/qr`);
    await user.click(await screen.findByRole('button', { name: 'Thu hồi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thu hồi mã QR?' });
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi' }));

    expect(await screen.findByText('Khách hàng chưa có mã QR đang hoạt động')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tạo mã QR' }));
    expect(await screen.findByText(newCode.url!)).toBeInTheDocument();
  });

  it('warns when the customer account is inactive', async () => {
    signedInAs(adminUser);
    server.use(
      http.get(`/api/admin/users/${id}`, () =>
        apiOk({ customer: { ...customerDetail, status: 'INACTIVE' } }),
      ),
      http.get(`/api/admin/users/${id}/qr`, () => apiOk({ current, history: [current] })),
    );
    renderApp(`/admin/users/${id}/qr`);
    expect(await screen.findByText('Tài khoản đang bị vô hiệu hóa')).toBeInTheDocument();
  });
});
