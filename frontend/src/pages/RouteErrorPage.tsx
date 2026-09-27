import { RefreshCw } from 'lucide-react';
import { useRouteError } from 'react-router';
import { Button } from '../components/ui/Button';
import { buttonClasses } from '../components/ui/button-classes';
import { Logo } from '../components/ui/Logo';

/**
 * After a new release the old page's lazily-loaded files no longer exist on the server; the
 * browser reports this as a failed dynamic import. A reload fetches the new version.
 */
function isStaleBundleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    message,
  );
}

/** Replaces React Router's developer-oriented default error screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  const stale = isStaleBundleError(error);
  if (import.meta.env.DEV) console.error(error);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4 text-center">
      <Logo />
      <div role="alert" className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold">
          {stale ? 'Ứng dụng vừa được cập nhật' : 'Đã có lỗi xảy ra'}
        </h1>
        <p className="text-fg-muted">
          {stale
            ? 'Vui lòng tải lại trang để dùng phiên bản mới nhất.'
            : 'Trang gặp sự cố không mong muốn. Vui lòng tải lại trang hoặc quay về trang chủ.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Tải lại trang
        </Button>
        {!stale && (
          // A plain link (not router navigation) so the app restarts from a clean state.
          <a href="/" className={buttonClasses('secondary')}>
            Về trang chủ
          </a>
        )}
      </div>
    </main>
  );
}
