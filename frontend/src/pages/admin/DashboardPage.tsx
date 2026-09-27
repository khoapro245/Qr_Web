import type { DashboardStats } from '@qrcare/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, QrCode, ShieldOff, UserCheck, UserX, Users } from 'lucide-react';
import { Link } from 'react-router';
import { fetchDashboard } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { customerKeys } from '../../features/customers/query-keys';
import { StatusBadge } from '../../features/customers/StatusBadge';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

const STATS: { key: keyof DashboardStats; label: string; Icon: typeof Users }[] = [
  { key: 'totalCustomers', label: 'Tổng khách hàng', Icon: Users },
  { key: 'activeCustomers', label: 'Đang hoạt động', Icon: UserCheck },
  { key: 'inactiveCustomers', label: 'Đã vô hiệu hóa', Icon: UserX },
  { key: 'activeQrCodes', label: 'QR đang hoạt động', Icon: QrCode },
  { key: 'revokedQrCodes', label: 'QR đã thu hồi', Icon: ShieldOff },
];

export function DashboardPage() {
  usePageTitle('Tổng quan');
  const { data, isPending, error, refetch } = useQuery({
    queryKey: customerKeys.dashboard,
    queryFn: fetchDashboard,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tổng quan</h1>
        <Link to="/admin/users/create" className={buttonClasses('primary')}>
          <Plus aria-hidden="true" className="size-4" />
          Thêm khách hàng
        </Link>
      </div>

      {error ? (
        <div className="space-y-3">
          <Alert tone="error" title="Không tải được số liệu">
            {errorMessage(error)}
          </Alert>
          <Button variant="secondary" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <dl
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy={isPending || undefined}
          >
            {/* dl > div > (dt, dd) only: the icon lives inside the dt so the structure stays
                valid and screen readers pair each label with its value. */}
            {STATS.map(({ key, label, Icon }) => (
              // pl-* must also be set at sm: Card's own sm:p-6 would otherwise override it.
              <Card
                key={key}
                className="relative flex min-h-24 flex-col justify-center pl-22 sm:pl-24"
              >
                <dt className="text-sm text-fg-muted">
                  <span className="absolute left-5 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg sm:left-6">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  {label}
                </dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {isPending ? (
                    <span className="inline-block h-7 w-12 animate-pulse rounded bg-surface-muted">
                      <span className="sr-only">Đang tải</span>
                    </span>
                  ) : (
                    data.stats[key].toLocaleString('vi-VN')
                  )}
                </dd>
              </Card>
            ))}
          </dl>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Khách hàng mới</h2>
              <Link to="/admin/users" className="text-sm font-medium text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
            {isPending ? null : data.recentCustomers.length === 0 ? (
              <p className="text-sm text-fg-muted">Chưa có khách hàng nào.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentCustomers.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/admin/users/${c.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.fullName}</p>
                        <p className="text-sm text-fg-muted">{formatDateTime(c.createdAt)}</p>
                      </div>
                      <StatusBadge status={c.status} />
                      <ChevronRight aria-hidden="true" className="size-4 text-fg-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
