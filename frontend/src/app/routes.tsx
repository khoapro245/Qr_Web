import type { RouteObject } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { RequireAuth } from '../features/auth/RequireAuth';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { ProfilePage } from '../pages/customer/ProfilePage';
import { HomeRedirect } from '../pages/HomeRedirect';
import { NotFoundPage } from '../pages/NotFoundPage';

export const routes: RouteObject[] = [
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth allowPendingPasswordChange />,
    children: [{ path: '/change-password', element: <ChangePasswordPage /> }],
  },
  {
    element: <RequireAuth roles={['ADMIN']} />,
    children: [
      {
        element: <AppShell area="admin" />,
        children: [{ path: '/admin', element: <DashboardPage /> }],
      },
    ],
  },
  {
    element: <RequireAuth roles={['CUSTOMER']} />,
    children: [
      {
        element: <AppShell area="customer" />,
        children: [{ path: '/profile', element: <ProfilePage /> }],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
