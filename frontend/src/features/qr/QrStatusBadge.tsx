import type { QrStatus } from '@qrcare/shared';
import { Badge } from '../../components/ui/Badge';

export function QrStatusBadge({ status }: { status: QrStatus }) {
  return status === 'ACTIVE' ? (
    <Badge tone="success">Đang hoạt động</Badge>
  ) : (
    <Badge tone="neutral">Đã thu hồi</Badge>
  );
}
