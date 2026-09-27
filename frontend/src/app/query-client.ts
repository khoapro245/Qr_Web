import { QueryClient } from '@tanstack/react-query';
import { getApiError } from '../api/client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // Retry transient failures only; a 4xx will not succeed on retry.
        retry: (failureCount, error) => !getApiError(error) && failureCount < 2,
      },
    },
  });
}
