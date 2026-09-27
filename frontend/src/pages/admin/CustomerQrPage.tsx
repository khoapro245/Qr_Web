import type { CustomerDetail, CustomerQrInfo } from '@qrcare/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Download, Printer, QrCode, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { fetchCustomer } from '../../api/customers';
import { fetchCustomerQr, generateQr, qrImageUrl, regenerateQr, revokeQr } from '../../api/qr';
import { Alert } from '../../components/ui/Alert';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CopyButton } from '../../components/ui/CopyButton';
import { Spinner } from '../../components/ui/Spinner';
import { customerKeys } from '../../features/customers/query-keys';
import { QrStatusBadge } from '../../features/qr/QrStatusBadge';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

type PendingAction = 'regenerate' | 'revoke' | null;

export function CustomerQrPage() {
  usePageTitle('Mã QR');
  const { id = '' } = useParams();
  const customer = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
  });
  const qr = useQuery({ queryKey: customerKeys.qr(id), queryFn: () => fetchCustomerQr(id) });

  const error = customer.error ?? qr.error;
  if (error) {
    return (
      <div className="space-y-4">
        <BackLink to="/admin/users">Danh sách khách hàng</BackLink>
        <Alert tone="error">{errorMessage(error)}</Alert>
      </div>
    );
  }
  if (!customer.data || !qr.data) {
    return (
      <div role="status" className="flex justify-center py-16 text-primary">
        <Spinner size="lg" />
        <span className="sr-only">Đang tải mã QR</span>
      </div>
    );
  }
  return <QrManager customer={customer.data} info={qr.data} />;
}

function QrManager({ customer, info }: { customer: CustomerDetail; info: CustomerQrInfo }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingAction>(null);
  const { current, history } = info;
  const name = customer.profile.fullName;

  const onChanged = (next: CustomerQrInfo) => {
    queryClient.setQueryData(customerKeys.qr(customer.id), next);
    // exact: the QR key is nested under the detail key and was just updated above.
    void queryClient.invalidateQueries({
      queryKey: customerKeys.detail(customer.id),
      exact: true,
    });
    void queryClient.invalidateQueries({ queryKey: customerKeys.lists });
    void queryClient.invalidateQueries({ queryKey: customerKeys.dashboard });
    setPending(null);
  };

  const generate = useMutation({ mutationFn: () => generateQr(customer.id), onSuccess: onChanged });
  const regenerate = useMutation({
    mutationFn: () => regenerateQr(customer.id),
    onSuccess: onChanged,
  });
  const revoke = useMutation({ mutationFn: () => revokeQr(customer.id), onSuccess: onChanged });
  const mutationError = generate.error ?? regenerate.error ?? revoke.error;

  return (
    <div className="space-y-6">
      <div className="space-y-2 print:hidden">
        <BackLink to={`/admin/users/${customer.id}`}>{name}</BackLink>
        <h1 className="text-2xl font-semibold">Mã QR</h1>
      </div>

      {customer.status === 'INACTIVE' && (
        <Alert tone="warning" title="Tài khoản đang bị vô hiệu hóa" className="print:hidden">
          Quét mã QR sẽ không hiển thị thông tin cho đến khi tài khoản được kích hoạt lại.
        </Alert>
      )}
      {mutationError && (
        <Alert tone="error" className="print:hidden">
          {errorMessage(mutationError)}
        </Alert>
      )}

      {current?.url ? (
        <Card className="grid gap-6 md:grid-cols-[auto_1fr] print:grid-cols-1 print:justify-items-center print:border-0 print:pt-16 print:shadow-none">
          <div className="flex flex-col items-center gap-2">
            <img
              src={qrImageUrl(customer.id, current.id)}
              alt={`Mã QR của ${name}`}
              className="size-64 rounded-xl border border-border bg-white p-2 print:size-[9cm] print:border-0"
            />
            {/* Only visible on paper, under the code. */}
            <p className="hidden text-center text-lg font-semibold print:block">{name}</p>
            <p className="hidden text-center text-sm print:block">
              QR Care — quét để xem thông tin hỗ trợ
            </p>
          </div>

          <div className="space-y-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <QrStatusBadge status={current.status} />
              <span className="text-sm text-fg-muted">
                Tạo lúc {formatDateTime(current.createdAt)}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Đường dẫn trong mã QR</p>
              <p className="rounded-lg bg-surface-muted px-3 py-2 font-mono text-sm break-all">
                {current.url}
              </p>
              <CopyButton value={current.url} label="Sao chép đường dẫn" />
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={qrImageUrl(customer.id, current.id, 'png', true)}
                download
                className={buttonClasses('secondary', 'sm')}
              >
                <Download aria-hidden="true" className="size-4" />
                Tải PNG
              </a>
              <a
                href={qrImageUrl(customer.id, current.id, 'svg', true)}
                download
                className={buttonClasses('secondary', 'sm')}
              >
                <Download aria-hidden="true" className="size-4" />
                Tải SVG (in ấn)
              </a>
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer aria-hidden="true" className="size-4" />
                In mã QR
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="secondary" size="sm" onClick={() => setPending('regenerate')}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Tạo lại mã QR
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending('revoke')}>
                <Ban aria-hidden="true" className="size-4" />
                Thu hồi
              </Button>
            </div>
            <p className="text-sm text-fg-muted">
              Dùng “Tạo lại” khi mã bị lộ hoặc áo bị mất: mã cũ ngừng hoạt động ngay và cần in mã
              mới lên áo.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-12 text-center print:hidden">
          <QrCode aria-hidden="true" className="size-10 text-fg-muted" />
          <p className="font-medium">Khách hàng chưa có mã QR đang hoạt động</p>
          <Button loading={generate.isPending} onClick={() => generate.mutate()}>
            Tạo mã QR
          </Button>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="print:hidden">
          <h2 className="mb-4 text-lg font-semibold">Lịch sử mã QR</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Lịch sử mã QR</caption>
              <thead className="text-fg-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Mã
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Trạng thái
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Tạo lúc
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Thu hồi lúc
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-4 font-mono">…{item.tokenHint}</td>
                    <td className="py-2 pr-4">
                      <QrStatusBadge status={item.status} />
                    </td>
                    <td className="py-2 pr-4">{formatDateTime(item.createdAt)}</td>
                    <td className="py-2">
                      {item.revokedAt ? formatDateTime(item.revokedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={pending === 'regenerate'}
        title="Tạo lại mã QR?"
        confirmLabel="Tạo mã mới"
        tone="danger"
        loading={regenerate.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => regenerate.mutate()}
      >
        Mã QR hiện tại sẽ <strong>ngừng hoạt động ngay lập tức</strong>. Áo đang in mã cũ sẽ không
        hiển thị thông tin nữa — bạn cần in và gắn mã mới cho khách hàng.
      </ConfirmDialog>

      <ConfirmDialog
        open={pending === 'revoke'}
        title="Thu hồi mã QR?"
        confirmLabel="Thu hồi"
        tone="danger"
        loading={revoke.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => revoke.mutate()}
      >
        Mã QR sẽ ngừng hoạt động và khách hàng sẽ không có mã nào cho đến khi bạn tạo mã mới.
      </ConfirmDialog>
    </div>
  );
}
