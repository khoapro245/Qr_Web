import type { AccountStatus } from '@qrcare/shared';
import { Badge } from '../../components/ui/Badge';
import { STATUS_LABELS } from '../../lib/format';

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={status === 'ACTIVE' ? 'success' : 'neutral'}>{STATUS_LABELS[status]}</Badge>;
}

export function QrBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'info' : 'neutral'}>{active ? 'Có QR' : 'Chưa có QR'}</Badge>;
}
