import { ArrowRight, HeartPulse } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useFirstAidContent } from './medical-content.storage';

export function DashboardFirstAidSummaryCard() {
  const { topics } = useFirstAidContent();

  return (
    <Card className="group relative flex flex-col justify-between p-5 transition hover:border-primary/50 hover:shadow-md">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg">
          <HeartPulse aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-fg">Cẩm nang sơ cứu ban đầu</h3>
            <Badge tone="neutral">{topics.length} chủ đề</Badge>
          </div>
          <p className="text-xs text-fg-muted">
            Quy trình DRCAB, ép tim CPR, cố định cột sống & cổ, cầm máu, bỏng...
          </p>
          <p className="text-xs font-medium text-fg-muted">
            Đồng bộ thời gian thực với trang sơ cứu công khai (/first-aid)
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-fg-muted">Thêm, sửa, xóa hướng dẫn</span>
        <Link
          to="/admin/first-aid"
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
