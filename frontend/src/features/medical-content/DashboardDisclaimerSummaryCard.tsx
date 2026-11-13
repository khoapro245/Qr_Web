import { ArrowRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { formatDateTime } from '../../lib/format';
import { useDisclaimerContent } from './medical-content.storage';

export function DashboardDisclaimerSummaryCard() {
  const { disclaimer } = useDisclaimerContent();

  return (
    <Card className="group relative flex flex-col justify-between p-5 transition hover:border-primary/50 hover:shadow-md">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning-soft-fg">
          <ShieldAlert aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-fg">Điều khoản miễn trừ trách nhiệm</h3>
            <Badge tone="success">Hiệu lực</Badge>
          </div>
          <p className="text-xs text-fg-muted">
            Quy định miễn trừ trách nhiệm y tế hiển thị trước khi xem hướng dẫn sơ cứu.
          </p>
          <p className="text-xs font-medium text-fg-muted">
            {disclaimer.items.length} điều khoản • Cập nhật: {formatDateTime(disclaimer.updatedAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-fg-muted">Quản lý & thiết lập nội dung</span>
        <Link
          to="/admin/disclaimer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:underline"
        >
          <span>Chi tiết & Chỉnh sửa</span>
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </Card>
  );
}
