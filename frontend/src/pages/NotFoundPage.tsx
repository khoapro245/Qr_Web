import { Link } from 'react-router';
import { buttonClasses } from '../components/ui/button-classes';
import { Logo } from '../components/ui/Logo';
import { usePageTitle } from '../lib/use-page-title';

export function NotFoundPage() {
  usePageTitle('Không tìm thấy trang');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4 text-center">
      <Logo />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
        <p className="text-fg-muted">Đường dẫn không tồn tại hoặc đã bị thay đổi.</p>
      </div>
      <Link to="/" className={buttonClasses('secondary')}>
        Về trang chủ
      </Link>
    </main>
  );
}
