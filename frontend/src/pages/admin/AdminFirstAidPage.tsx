import { BackLink } from '../../components/ui/BackLink';
import { AdminFirstAidCard } from '../../features/medical-content/AdminFirstAidCard';
import { usePageTitle } from '../../lib/use-page-title';

export function AdminFirstAidPage() {
  usePageTitle('Quản lý Cẩm nang sơ cứu theo bệnh lý');

  return (
    <div className="space-y-6">
      <div>
        <BackLink to="/admin">Quay lại Tổng quan</BackLink>
        <div className="mt-3">
          <h1 className="text-2xl font-semibold text-fg">Quản lý Cẩm nang sơ cứu theo bệnh lý</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Quản lý danh sách các bệnh lý (tim mạch, động kinh, hen suyễn, đái tháo đường, đột
            quỵ...) và toàn bộ cẩm nang sơ cứu cấp cứu chuyên sâu cho từng loại bệnh. Khách hàng có
            thể chọn bệnh đi kèm trong hồ sơ và người quét mã QR sẽ được hướng dẫn sơ cứu đúng bệnh.
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        <AdminFirstAidCard />
      </div>
    </div>
  );
}
