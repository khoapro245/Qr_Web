import type { CustomerDetail } from '@qrcare/shared';
import { QrCode } from 'lucide-react';
import { Link } from 'react-router';
import { qrImageUrl } from '../../api/qr';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { formatDateTime } from '../../lib/format';
import { QrStatusBadge } from './QrStatusBadge';

/** Compact QR section on the customer detail page. */
export function QrSummaryCard({ customer }: { customer: CustomerDetail }) {
  const { qr } = customer;
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Mã QR</h2>
        {qr && <QrStatusBadge status={qr.status} />}
      </div>
      {qr ? (
        <div className="flex items-center gap-4">
          <img
            src={qrImageUrl(customer.id, qr.id)}
            alt={`Mã QR của ${customer.profile.fullName}`}
            className="size-24 shrink-0 rounded-lg border border-border bg-white p-1"
          />
          <p className="text-sm text-fg-muted">Tạo lúc {formatDateTime(qr.createdAt)}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-fg-muted">
          <QrCode aria-hidden="true" className="size-8 shrink-0" />
          Khách hàng chưa có mã QR đang hoạt động.
        </div>
      )}
      <Link
        to={`/admin/users/${customer.id}/qr`}
        className={buttonClasses('secondary', 'sm', true)}
      >
        Quản lý mã QR
      </Link>
    </Card>
  );
}
