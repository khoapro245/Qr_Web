import type { AccountStatus } from '@qrcare/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Users } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { fetchCustomers } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { SelectField } from '../../components/ui/SelectField';
import { Spinner } from '../../components/ui/Spinner';
import { TextField } from '../../components/ui/TextField';
import { customerKeys } from '../../features/customers/query-keys';
import { QrBadge, StatusBadge } from '../../features/customers/StatusBadge';
import { errorMessage } from '../../lib/errors';
import { formatPhone, STATUS_LABELS } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function CustomersPage() {
  usePageTitle('Khách hàng');
  // Filters live in the URL so back/forward and reload keep them.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const status = (params.get('status') ?? '') as AccountStatus | '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);

  const updateParams = (changes: Record<string, string | number | null>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );
  };

  // Debounce typing before hitting the API.
  const commitSearch = useEffectEvent((value: string) => updateParams({ q: value, page: 1 }));
  useEffect(() => {
    const value = searchInput.trim();
    if (value === search) return;
    const timer = setTimeout(() => commitSearch(value), 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: customerKeys.list({ search, status, page }),
    queryFn: () => fetchCustomers({ search, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const filtered = search !== '' || status !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Khách hàng</h1>
        <Link to="/admin/users/create" className={buttonClasses('primary')}>
          <Plus aria-hidden="true" className="size-4" />
          Thêm khách hàng
        </Link>
      </div>

      <Card className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="relative">
          <TextField
            label="Tìm kiếm"
            type="search"
            placeholder="Tên, email hoặc số điện thoại"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-fg-muted"
          />
        </div>
        <SelectField
          label="Trạng thái"
          placeholder="Tất cả"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
        />
      </Card>

      {error ? (
        <div className="space-y-3">
          <Alert tone="error" title="Không tải được danh sách">
            {errorMessage(error)}
          </Alert>
          <Button variant="secondary" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : isPending ? (
        <div role="status" className="flex justify-center py-12 text-primary">
          <Spinner size="lg" />
          <span className="sr-only">Đang tải danh sách khách hàng</span>
        </div>
      ) : data.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Users aria-hidden="true" className="size-10 text-fg-muted" />
          <p className="font-medium">
            {filtered ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng nào'}
          </p>
          {!filtered && (
            <Link to="/admin/users/create" className={buttonClasses('secondary', 'sm')}>
              Thêm khách hàng đầu tiên
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4" aria-busy={isFetching || undefined}>
          <p className="text-sm text-fg-muted" aria-live="polite">
            {data.total.toLocaleString('vi-VN')} khách hàng
          </p>

          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/admin/users/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium">{c.fullName}</p>
                    <p className="truncate text-sm text-fg-muted">
                      {[c.email, formatPhone(c.phone)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <StatusBadge status={c.status} />
                      <QrBadge active={c.hasActiveQr} />
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Danh sách khách hàng</caption>
              <thead className="bg-surface-muted text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Họ và tên
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Liên hệ đăng nhập
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tuổi
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    QR
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3 font-medium">{c.fullName}</td>
                    <td className="px-4 py-3 text-fg-muted">
                      <div>{c.email}</div>
                      <div>{formatPhone(c.phone)}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.age}</td>
                    <td className="px-4 py-3">
                      <QrBadge active={c.hasActiveQr} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/users/${c.id}`}
                        className="font-medium text-primary hover:underline"
                        aria-label={`Xem chi tiết ${c.fullName}`}
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(next) => updateParams({ page: next })}
          />
        </div>
      )}
    </div>
  );
}
