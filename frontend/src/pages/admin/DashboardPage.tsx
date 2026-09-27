import type { DashboardStats } from '@qrcare/shared';
import { useQuery } from '@tanstack/react-query';
import { QrCode, ShieldOff, UserCheck, UserX, Users } from 'lucide-react';
import { fetchDashboardStats } from '../../api/admin';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { errorMessage } from '../../lib/errors';
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
    queryKey: ['admin', 'dashboard'],
    queryFn: fetchDashboardStats,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tổng quan</h1>

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
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isPending || undefined}>
          {STATS.map(({ key, label, Icon }) => (
            <Card key={key} className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <div>
                <dt className="text-sm text-fg-muted">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {isPending ? (
                    <span className="inline-block h-7 w-12 animate-pulse rounded bg-surface-muted">
                      <span className="sr-only">Đang tải</span>
                    </span>
                  ) : (
                    data[key].toLocaleString('vi-VN')
                  )}
                </dd>
              </div>
            </Card>
          ))}
        </dl>
      )}
    </div>
  );
}
