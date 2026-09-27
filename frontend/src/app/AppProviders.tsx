import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { onSessionExpired } from '../api/client';
import { noteSessionEnded } from '../features/auth/session-notice';
import { AUTH_QUERY_KEY } from '../features/auth/use-auth';
import { ThemeProvider } from '../lib/ThemeProvider';

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  useEffect(() => {
    onSessionExpired((reason) => {
      // Explain the redirect only to someone who was actually signed in, not to a visitor
      // who simply opened a protected page.
      if (queryClient.getQueryData(AUTH_QUERY_KEY)) noteSessionEnded(reason);
      // Forget everything fetched under the old session; guards then redirect to /login.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== AUTH_QUERY_KEY[0] });
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
    });
  }, [queryClient]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
