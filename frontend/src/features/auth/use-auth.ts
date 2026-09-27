import type { AuthUser, UserRole } from '@qrcare/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { fetchCurrentUser, logout } from '../../api/auth';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export function homePathFor(role: UserRole): string {
  return role === 'ADMIN' ? '/admin' : '/profile';
}

export function useAuth() {
  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSetAuthUser() {
  const queryClient = useQueryClient();
  return (user: AuthUser | null) => queryClient.setQueryData(AUTH_QUERY_KEY, user);
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Drop every cached response: the next user of this browser must not see them.
      queryClient.clear();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      void navigate('/login', { replace: true });
    },
  });
}
