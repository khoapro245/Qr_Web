import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  adminUser,
  customerDetail,
  customerSummary,
  customerUser,
  ownProfile,
  signedInAs,
} from './fixtures';
import { apiError, apiOk, server } from './msw/server';
import { renderApp } from './utils/render';

describe('admin customer management', () => {
  it('validates required fields and consent before creating', async () => {
    signedInAs(adminUser);
    const { user } = renderApp('/admin/users/create');
    await user.click(await screen.findByRole('button', { name: 'Tạo khách hàng' }));

    expect(await screen.findByText('Vui lòng nhập họ tên')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập ngày sinh')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn giới tính')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập số điện thoại gia đình')).toBeInTheDocument();
    expect(
      screen.getByText('Cần ít nhất email hoặc số điện thoại để khách hàng đăng nhập'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Cần xác nhận khách hàng đã đồng ý công khai thông tin trên mã QR'),
    ).toBeInTheDocument();
  });

  it('creates a customer and shows the temporary password once', async () => {
    signedInAs(adminUser);
    let body: unknown;
    server.use(
      http.post('/api/admin/users', async ({ request }) => {
        body = await request.json();
        return apiOk({ customer: customerDetail, temporaryPassword: 'hT4k-9mQx-Rw2p' });
      }),
      http.get(`/api/admin/users/${customerDetail.id}`, () => apiOk({ customer: customerDetail })),
    );

    const { user, router } = renderApp('/admin/users/create');
    await user.type(await screen.findByLabelText(/Họ và tên/), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/Ngày sinh/), '2006-03-19');
    await user.selectOptions(screen.getByLabelText(/Giới tính/), 'MALE');
    await user.type(screen.getByLabelText(/SĐT gia đình/), '0987 654 321');
    await user.selectOptions(screen.getByLabelText(/Nhóm máu/), 'O+');
    await user.type(screen.getByLabelText(/Cân nặng/), '60,5');
    await user.type(screen.getByLabelText(/Chiều cao/), '170');
    await user.type(screen.getByLabelText(/^Số điện thoại di động/), '0912 345 678');
    await user.click(screen.getByLabelText(/đã được giải thích và đồng ý/));
    await user.click(screen.getByRole('button', { name: 'Tạo khách hàng' }));

    expect(await screen.findByText('hT4k-9mQx-Rw2p')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/admin/users/${customerDetail.id}`);
    expect(body).toMatchObject({
      fullName: 'Nguyễn Văn A',
      dateOfBirth: '2006-03-19',
      gender: 'MALE',
      familyPhone: '+84987654321',
      phone: '+84912345678',
      email: null,
      weightKg: 60.5,
      heightCm: 170,
      password: null,
      publicConsent: true,
    });
    // The one-time state was cleared from history.
    expect(router.state.location.state).toBeNull();
  });

  it('shows a duplicate email next to the email field', async () => {
    signedInAs(adminUser);
    server.use(
      http.post('/api/admin/users', () =>
        apiError(409, 'EMAIL_TAKEN', [
          { path: 'email', message: 'Email này đã được dùng cho tài khoản khác' },
        ]),
      ),
    );
    const { user } = renderApp('/admin/users/create');
    await user.type(await screen.findByLabelText(/Họ và tên/), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/Ngày sinh/), '2006-03-19');
    await user.selectOptions(screen.getByLabelText(/Giới tính/), 'MALE');
    await user.type(screen.getByLabelText(/SĐT gia đình/), '0987654321');
    await user.type(screen.getByLabelText(/^Email/), 'dup@example.com');
    await user.click(screen.getByLabelText(/đã được giải thích và đồng ý/));
    await user.click(screen.getByRole('button', { name: 'Tạo khách hàng' }));

    expect(
      await screen.findByText('Email này đã được dùng cho tài khoản khác'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('lists customers and searches as the admin types', async () => {
    signedInAs(adminUser);
    const searches: string[] = [];
    server.use(
      http.get('/api/admin/users', ({ request }) => {
        const search = new URL(request.url).searchParams.get('search') ?? '';
        searches.push(search);
        const items = search === '' || search === 'nguyen' ? [customerSummary] : [];
        return apiOk({ items, page: 1, pageSize: 20, total: items.length });
      }),
    );

    const { user, router } = renderApp('/admin/users');
    expect((await screen.findAllByText('Nguyễn Văn A')).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Tìm kiếm'), 'zzz');
    expect(await screen.findByText('Không tìm thấy khách hàng phù hợp')).toBeInTheDocument();
    expect(searches).toContain('zzz');
    expect(router.state.location.search).toBe('?q=zzz');
  });

  it('deactivates a customer after confirmation', async () => {
    signedInAs(adminUser);
    let patchBody: unknown;
    server.use(
      http.get(`/api/admin/users/${customerDetail.id}`, () => apiOk({ customer: customerDetail })),
      http.patch(`/api/admin/users/${customerDetail.id}/status`, async ({ request }) => {
        patchBody = await request.json();
        return apiOk({ customer: { ...customerDetail, status: 'INACTIVE' } });
      }),
    );

    const { user } = renderApp(`/admin/users/${customerDetail.id}`);
    await user.click(await screen.findByRole('button', { name: 'Vô hiệu hóa' }));

    const dialog = await screen.findByRole('dialog', { name: 'Vô hiệu hóa khách hàng?' });
    await user.click(within(dialog).getByRole('button', { name: 'Vô hiệu hóa' }));

    expect(await screen.findByText('Tài khoản đang bị vô hiệu hóa')).toBeInTheDocument();
    expect(patchBody).toEqual({ status: 'INACTIVE' });
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeInTheDocument();
  });

  it('shows a not-found state for an unknown customer', async () => {
    signedInAs(adminUser);
    server.use(http.get('/api/admin/users/missing', () => apiError(404, 'CUSTOMER_NOT_FOUND')));
    renderApp('/admin/users/missing');
    expect(await screen.findByText('Không tìm thấy khách hàng')).toBeInTheDocument();
  });
});

describe('customer profile', () => {
  it('shows the profile with derived age and the avatar notice', async () => {
    signedInAs(customerUser);
    server.use(http.get('/api/me/profile', () => apiOk(ownProfile)));
    renderApp('/profile');

    expect(await screen.findByText('19/03/2006')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('0987 654 321')).toBeInTheDocument();
    expect(screen.getByText(/Ảnh đại diện do nhà sản xuất quản lý/)).toBeInTheDocument();
    // No way to upload an avatar here.
    expect(screen.queryByLabelText(/ảnh/i, { selector: 'input[type="file"]' })).toBeNull();
  });

  it('edits and saves the own profile', async () => {
    signedInAs(customerUser);
    let putBody: unknown;
    server.use(
      http.get('/api/me/profile', () => apiOk(ownProfile)),
      http.put('/api/me/profile', async ({ request }) => {
        putBody = await request.json();
        return apiOk({
          ...ownProfile,
          profile: { ...ownProfile.profile, address: 'Địa chỉ mới' },
        });
      }),
    );
    const { user } = renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));

    const address = screen.getByLabelText(/Địa chỉ/);
    await user.clear(address);
    await user.type(address, 'Địa chỉ mới');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Đã lưu thay đổi hồ sơ.')).toBeInTheDocument();
    expect(screen.getByText('Địa chỉ mới')).toBeInTheDocument();
    expect(putBody).toMatchObject({
      address: 'Địa chỉ mới',
      familyPhone: '+84987654321',
      weightKg: 60.5,
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull());
  });
});
