import type { UserRole } from '@qrcare/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { errorMessage } from '../../lib/errors';
import { homePathFor, useAuth } from './use-auth';

interface RequireAuthProps {
  roles?: UserRole[];
  /** Only the change-password page may be visited while a password change is pending. */
  allowPendingPasswordChange?: boolean;
}

/**
 * Client-side route guard. It only decides what to render — every API endpoint enforces
 * authentication and roles on the server regardless.
 */
export function RequireAuth({ roles, allowPendingPasswordChange = false }: RequireAuthProps) {
  const { user, isLoading, error, refetch } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
        <Alert tone="error" title="Không tải được phiên đăng nhập">
          {errorMessage(error)}
        </Alert>
        <Button variant="secondary" onClick={() => void refetch()}>
          Thử lại
        </Button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <Outlet />;
}
