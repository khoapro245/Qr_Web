import { Navigate } from 'react-router';
import { FullPageSpinner } from '../components/ui/Spinner';
import { homePathFor, useAuth } from '../features/auth/use-auth';

export function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(user.role)} replace />;
}
