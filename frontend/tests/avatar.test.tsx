import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  adminUser,
  customerDetail,
  customerUser,
  ownProfile,
  signedInAs,
  withAvatar,
} from './fixtures';
import { apiError, apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

const detailUrl = `/api/admin/users/${customerDetail.id}`;

function pngFile(name = 'photo.png', size = 1024, type = 'image/png') {
  return new File([new Uint8Array(size)], name, { type });
}

function fileInput(): HTMLElement {
  return screen.getByTestId('avatar-input');
}

describe('admin avatar management', () => {
  it('uploads an avatar and shows it', async () => {
    signedInAs(adminUser);
    let contentType: string | null = null;
    let body = '';
    server.use(
      http.get(detailUrl, () => apiOk({ customer: customerDetail })),
      http.put(`${detailUrl}/avatar`, async ({ request }) => {
        // jsdom→Node conversion in the test runner drops file bytes, so only the request
        // shape is checked here; real file handling is covered by the backend tests.
        contentType = request.headers.get('content-type');
        body = await request.text();
        return apiOk({ customer: withAvatar(customerDetail) });
      }),
    );

    const { user } = renderApp(`/admin/users/${customerDetail.id}`);
    expect(await screen.findByRole('img', { name: /chưa có ảnh đại diện/ })).toBeInTheDocument();
    await user.upload(fileInput(), pngFile());

    const img = await screen.findByRole('img', { name: 'Ảnh đại diện của Nguyễn Văn A' });
    expect(img).toHaveAttribute('src', `${detailUrl}/avatar?v=abc123def456`);
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(body).toContain('name="avatar"');
    expect(screen.getByRole('button', { name: 'Đổi ảnh' })).toBeInTheDocument();
  });

  it('rejects oversized and non-image files before uploading', async () => {
    signedInAs(adminUser);
    let uploads = 0;
    server.use(
      http.get(detailUrl, () => apiOk({ customer: customerDetail })),
      http.put(`${detailUrl}/avatar`, () => {
        uploads += 1;
        return apiOk({ customer: customerDetail });
      }),
    );
    // applyAccept: false bypasses the input's accept filter, like a crafted file choice.
    const { user } = renderApp(`/admin/users/${customerDetail.id}`, { applyAccept: false });
    await screen.findByRole('button', { name: 'Tải ảnh lên' });

    await user.upload(fileInput(), pngFile('big.png', 5 * 1024 * 1024 + 1));
    expect(
      await screen.findByText('Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.'),
    ).toBeInTheDocument();

    await user.upload(fileInput(), pngFile('notes.txt', 10, 'text/plain'));
    expect(await screen.findByText('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.')).toBeInTheDocument();
    expect(uploads).toBe(0);
  });

  it('shows the server verdict when the file is not a real image', async () => {
    signedInAs(adminUser);
    server.use(
      http.get(detailUrl, () => apiOk({ customer: customerDetail })),
      http.put(`${detailUrl}/avatar`, () => apiError(400, 'INVALID_IMAGE')),
    );
    const { user } = renderApp(`/admin/users/${customerDetail.id}`);
    await screen.findByRole('button', { name: 'Tải ảnh lên' });
    await user.upload(fileInput(), pngFile());
    expect(
      await screen.findByText('Tệp không phải ảnh hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.'),
    ).toBeInTheDocument();
  });

  it('removes the avatar after confirmation', async () => {
    signedInAs(adminUser);
    let deleted = false;
    server.use(
      http.get(detailUrl, () => apiOk({ customer: withAvatar(customerDetail) })),
      http.delete(`${detailUrl}/avatar`, () => {
        deleted = true;
        return apiOk({ customer: customerDetail });
      }),
    );
    const { user } = renderApp(`/admin/users/${customerDetail.id}`);
    await user.click(await screen.findByRole('button', { name: 'Xóa ảnh' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xóa ảnh đại diện?' });
    await user.click(within(dialog).getByRole('button', { name: 'Xóa ảnh' }));

    expect(await screen.findByRole('button', { name: 'Tải ảnh lên' })).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it('uploads the avatar chosen while creating a customer', async () => {
    signedInAs(adminUser);
    const calls: string[] = [];
    server.use(
      http.post('/api/admin/users', () => {
        calls.push('create');
        return apiOk({ customer: customerDetail, temporaryPassword: null });
      }),
      http.put(`${detailUrl}/avatar`, () => {
        calls.push('avatar');
        return apiOk({ customer: withAvatar(customerDetail) });
      }),
      http.get(detailUrl, () => apiOk({ customer: withAvatar(customerDetail) })),
    );

    const { user } = renderApp('/admin/users/create');
    await user.type(await screen.findByLabelText(/Họ và tên/), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/Ngày sinh/), '2006-03-19');
    await user.selectOptions(screen.getByLabelText(/Giới tính/), 'MALE');
    await user.type(screen.getByLabelText(/SĐT gia đình/), '0987654321');
    await user.type(screen.getByLabelText(/^Email/), 'a@example.com');
    await user.upload(fileInput(), pngFile());
    await user.click(screen.getByLabelText(/đã được giải thích và đồng ý/));
    await user.click(screen.getByRole('button', { name: 'Tạo khách hàng' }));

    expect(await screen.findByText('Đã tạo khách hàng')).toBeInTheDocument();
    expect(calls).toEqual(['create', 'avatar']);
  });
});

describe('customer avatar', () => {
  it('shows the own avatar read-only', async () => {
    signedInAs(customerUser);
    server.use(
      http.get('/api/me/profile', () =>
        apiOk({ ...ownProfile, profile: withAvatar(customerDetail).profile }),
      ),
      http.get('/api/me/avatar', () => new HttpResponse(null, { status: 200 })),
    );
    renderApp('/profile');
    const img = await screen.findByRole('img', { name: 'Ảnh đại diện của Nguyễn Văn A' });
    expect(img).toHaveAttribute('src', '/api/me/avatar?v=abc123def456');
    expect(screen.queryByTestId('avatar-input')).toBeNull();
    expect(screen.queryByRole('button', { name: /ảnh/i })).toBeNull();
  });
});
