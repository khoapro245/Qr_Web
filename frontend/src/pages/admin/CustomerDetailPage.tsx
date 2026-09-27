import type { AccountStatus, CustomerDetail } from '@qrcare/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { getApiError } from '../../api/client';
import { fetchCustomer, resetCustomerPassword, setCustomerStatus } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { BackLink } from '../../components/ui/BackLink';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { Spinner } from '../../components/ui/Spinner';
import { AvatarManager } from '../../features/customers/AvatarManager';
import { ProfileDetails } from '../../features/customers/ProfileDetails';
import { customerKeys } from '../../features/customers/query-keys';
import { StatusBadge } from '../../features/customers/StatusBadge';
import { TemporaryPasswordNotice } from '../../features/customers/TemporaryPasswordNotice';
import { errorMessage } from '../../lib/errors';
import { formatDateTime, formatPhone, STATUS_LABELS } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';
import type { CreatedCustomerState } from './CustomerCreatePage';

type PendingAction = 'status' | 'reset-password' | null;

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Read the one-time creation state once, then wipe it from history so a reload or
  // back-navigation never shows the temporary password again.
  const [created] = useState(() => location.state as CreatedCustomerState | null);
  const [oneTimePassword, setOneTimePassword] = useState(
    created?.temporaryPassword
      ? { value: created.temporaryPassword, title: 'Đã tạo khách hàng' }
      : null,
  );
  useEffect(() => {
    if (location.state) void navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const [pending, setPending] = useState<PendingAction>(null);

  const query = useQuery({ queryKey: customerKeys.detail(id), queryFn: () => fetchCustomer(id) });
  usePageTitle(query.data?.profile.fullName ?? 'Chi tiết khách hàng');

  const onUpdated = (customer: CustomerDetail) => {
    queryClient.setQueryData(customerKeys.detail(id), customer);
    void queryClient.invalidateQueries({ queryKey: customerKeys.lists });
    void queryClient.invalidateQueries({ queryKey: customerKeys.dashboard });
  };

  const statusMutation = useMutation({
    mutationFn: (status: AccountStatus) => setCustomerStatus(id, status),
    onSuccess: (customer) => {
      onUpdated(customer);
      setPending(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetCustomerPassword(id),
    onSuccess: ({ temporaryPassword }) => {
      setOneTimePassword({ value: temporaryPassword, title: 'Đã cấp lại mật khẩu' });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
    },
  });

  if (query.isPending) {
    return (
      <div role="status" className="flex justify-center py-16 text-primary">
        <Spinner size="lg" />
        <span className="sr-only">Đang tải thông tin khách hàng</span>
      </div>
    );
  }

  if (query.error) {
    const notFound = getApiError(query.error)?.code === 'CUSTOMER_NOT_FOUND';
    return (
      <div className="space-y-4">
        <BackLink to="/admin/users">Danh sách khách hàng</BackLink>
        <Alert
          tone="error"
          title={notFound ? 'Không tìm thấy khách hàng' : 'Không tải được dữ liệu'}
        >
          {notFound
            ? 'Khách hàng không tồn tại hoặc đường dẫn không đúng.'
            : errorMessage(query.error)}
        </Alert>
      </div>
    );
  }

  const customer = query.data;
  const active = customer.status === 'ACTIVE';
  const mutationError = statusMutation.error ?? resetMutation.error;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackLink to="/admin/users">Danh sách khách hàng</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold break-words">{customer.profile.fullName}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/users/${id}/edit`} className={buttonClasses('secondary', 'sm')}>
              <Pencil aria-hidden="true" className="size-4" />
              Chỉnh sửa
            </Link>
            <Button variant="secondary" size="sm" onClick={() => setPending('reset-password')}>
              <KeyRound aria-hidden="true" className="size-4" />
              Cấp lại mật khẩu
            </Button>
            <Button
              variant={active ? 'danger' : 'primary'}
              size="sm"
              onClick={() => setPending('status')}
            >
              <Power aria-hidden="true" className="size-4" />
              {active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
            </Button>
          </div>
        </div>
      </div>

      {created?.avatarFailed && (
        <Alert tone="warning" title="Chưa tải được ảnh đại diện">
          Khách hàng đã được tạo nhưng ảnh chưa được lưu. Vui lòng tải ảnh lên lại ở mục “Ảnh đại
          diện”.
        </Alert>
      )}
      {created && !created.temporaryPassword && (
        <Alert tone="success" title="Đã tạo khách hàng">
          Khách hàng sẽ đăng nhập bằng mật khẩu bạn đã đặt và phải đổi mật khẩu ở lần đầu.
        </Alert>
      )}
      {oneTimePassword && (
        <TemporaryPasswordNotice password={oneTimePassword.value} title={oneTimePassword.title} />
      )}
      {mutationError && <Alert tone="error">{errorMessage(mutationError)}</Alert>}
      {!active && (
        <Alert tone="warning" title="Tài khoản đang bị vô hiệu hóa">
          Khách hàng không thể đăng nhập và mã QR không hiển thị thông tin.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Thông tin cá nhân</h2>
            <ProfileDetails profile={customer.profile} />
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Thông tin đăng nhập</h2>
            <DescriptionList
              items={[
                { label: 'Email', value: customer.account.email },
                { label: 'Số điện thoại', value: formatPhone(customer.account.phone) },
                {
                  label: 'Mật khẩu',
                  value: customer.account.mustChangePassword ? (
                    <Badge tone="info">Đang dùng mật khẩu tạm</Badge>
                  ) : (
                    'Đã đặt mật khẩu riêng'
                  ),
                },
                {
                  label: 'Đăng nhập gần nhất',
                  value: customer.account.lastLoginAt
                    ? formatDateTime(customer.account.lastLoginAt)
                    : 'Chưa đăng nhập',
                },
                ...(customer.account.lockedUntil
                  ? [
                      {
                        label: 'Tạm khóa đến',
                        value: (
                          <Badge tone="danger">
                            {formatDateTime(customer.account.lockedUntil)}
                          </Badge>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </div>
        <div className="space-y-6">
          <AvatarManager customer={customer} />
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Trạng thái tài khoản</h2>
            <DescriptionList
              items={[
                { label: 'Trạng thái', value: STATUS_LABELS[customer.status], wide: true },
                { label: 'Ngày tạo', value: formatDateTime(customer.createdAt), wide: true },
                { label: 'Cập nhật', value: formatDateTime(customer.updatedAt), wide: true },
                {
                  label: 'Đồng ý công khai',
                  value: customer.publicConsentAt ? formatDateTime(customer.publicConsentAt) : null,
                  wide: true,
                },
              ]}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pending === 'status'}
        title={active ? 'Vô hiệu hóa khách hàng?' : 'Kích hoạt lại khách hàng?'}
        confirmLabel={active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
        tone={active ? 'danger' : 'primary'}
        loading={statusMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => statusMutation.mutate(active ? 'INACTIVE' : 'ACTIVE')}
      >
        {active
          ? 'Khách hàng sẽ bị đăng xuất ngay, không thể đăng nhập, và mã QR trên áo sẽ không còn hiển thị thông tin.'
          : 'Khách hàng có thể đăng nhập lại và mã QR đang hoạt động sẽ hiển thị thông tin trở lại.'}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending === 'reset-password'}
        title="Cấp lại mật khẩu?"
        confirmLabel="Cấp mật khẩu mới"
        loading={resetMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => resetMutation.mutate()}
      >
        Mật khẩu hiện tại sẽ ngừng hoạt động và khách hàng bị đăng xuất khỏi mọi thiết bị. Mật khẩu
        tạm mới sẽ hiển thị một lần để bạn giao cho khách hàng.
      </ConfirmDialog>
    </div>
  );
}
