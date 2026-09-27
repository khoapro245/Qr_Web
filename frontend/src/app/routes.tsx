import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { RootLayout } from '../components/layout/RootLayout';
import { FullPageSpinner } from '../components/ui/Spinner';
import { RequireAuth } from '../features/auth/RequireAuth';
import { HomeRedirect } from '../pages/HomeRedirect';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PublicQrPage } from '../pages/public/PublicQrPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';

/**
 * Loads a page's code only when its route is visited. The public QR page stays in the main
 * bundle so a scan renders as fast as possible; admin and customer pages load on demand.
 */
function lazyPage<T extends Record<string, unknown>>(
  load: () => Promise<T>,
  name: keyof T & string,
): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => ({ Component: (await load())[name] as ComponentType }),
  };
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // Friendly fallback for unexpected render errors and stale lazy chunks after a deploy.
    errorElement: <RouteErrorPage />,
    // Shown while the first lazily-loaded route resolves.
    HydrateFallback: FullPageSpinner,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/qr/:token', element: <PublicQrPage /> },
      {
        path: '/login',
        ...lazyPage(() => import('../pages/auth/LoginPage'), 'LoginPage'),
      },
      {
        path: '/forgot-password',
        ...lazyPage(() => import('../pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage'),
      },
      {
        path: '/reset-password',
        ...lazyPage(() => import('../pages/auth/ResetPasswordPage'), 'ResetPasswordPage'),
      },
      {
        element: <RequireAuth allowPendingPasswordChange />,
        children: [
          {
            path: '/change-password',
            ...lazyPage(() => import('../pages/auth/ChangePasswordPage'), 'ChangePasswordPage'),
          },
        ],
      },
      {
        element: <RequireAuth roles={['ADMIN']} />,
        children: [
          {
            element: <AppShell area="admin" />,
            children: [
              {
                path: '/admin',
                ...lazyPage(() => import('../pages/admin/DashboardPage'), 'DashboardPage'),
              },
              {
                path: '/admin/users',
                ...lazyPage(() => import('../pages/admin/CustomersPage'), 'CustomersPage'),
              },
              {
                path: '/admin/users/create',
                ...lazyPage(
                  () => import('../pages/admin/CustomerCreatePage'),
                  'CustomerCreatePage',
                ),
              },
              {
                path: '/admin/users/:id',
                ...lazyPage(
                  () => import('../pages/admin/CustomerDetailPage'),
                  'CustomerDetailPage',
                ),
              },
              {
                path: '/admin/users/:id/edit',
                ...lazyPage(() => import('../pages/admin/CustomerEditPage'), 'CustomerEditPage'),
              },
              {
                path: '/admin/users/:id/qr',
                ...lazyPage(() => import('../pages/admin/CustomerQrPage'), 'CustomerQrPage'),
              },
            ],
          },
        ],
      },
      {
        element: <RequireAuth roles={['CUSTOMER']} />,
        children: [
          {
            element: <AppShell area="customer" />,
            children: [
              {
                path: '/profile',
                ...lazyPage(() => import('../pages/customer/ProfilePage'), 'ProfilePage'),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
