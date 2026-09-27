import { formatVietnamPhone } from '@qrcare/shared';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../features/auth/use-auth';
import { usePageTitle } from '../../lib/use-page-title';

// Account overview for Milestone 3; the editable profile is added in Milestone 4.
export function ProfilePage() {
  usePageTitle('Hồ sơ của tôi');
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Xin chào, {user.displayName}</h1>
      <Card>
        <h2 className="text-lg font-semibold">Thông tin đăng nhập</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-fg-muted">Email</dt>
            <dd className="font-medium">{user.email ?? 'Chưa có'}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-muted">Số điện thoại</dt>
            <dd className="font-medium">
              {user.phone ? formatVietnamPhone(user.phone) : 'Chưa có'}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
