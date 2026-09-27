import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { onSessionExpired } from '../api/client';
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
    onSessionExpired(() => {
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
