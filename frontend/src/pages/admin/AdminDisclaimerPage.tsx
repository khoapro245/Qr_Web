import { BackLink } from '../../components/ui/BackLink';
import { AdminDisclaimerCard } from '../../features/medical-content/AdminDisclaimerCard';
import { usePageTitle } from '../../lib/use-page-title';

export function AdminDisclaimerPage() {
  usePageTitle('Quản lý Điều khoản miễn trừ trách nhiệm');

  return (
    <div className="space-y-6">
      <div>
        <BackLink to="/admin">Quay lại Tổng quan</BackLink>
        <div className="mt-3">
          <h1 className="text-2xl font-semibold text-fg">
            Quản lý Điều khoản miễn trừ trách nhiệm
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Chỉnh sửa nội dung popup điều khoản y tế và pháp lý hiển thị trước khi người dùng xem
            hướng dẫn sơ cứu khẩn cấp.
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        <AdminDisclaimerCard />
      </div>
    </div>
  );
}
