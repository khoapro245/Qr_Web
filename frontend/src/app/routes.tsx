import type { RouteObject } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CustomerCreatePage } from '../pages/admin/CustomerCreatePage';
import { CustomerDetailPage } from '../pages/admin/CustomerDetailPage';
import { CustomerEditPage } from '../pages/admin/CustomerEditPage';
import { CustomerQrPage } from '../pages/admin/CustomerQrPage';
import { CustomersPage } from '../pages/admin/CustomersPage';
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
        children: [
          { path: '/admin', element: <DashboardPage /> },
          { path: '/admin/users', element: <CustomersPage /> },
          { path: '/admin/users/create', element: <CustomerCreatePage /> },
          { path: '/admin/users/:id', element: <CustomerDetailPage /> },
          { path: '/admin/users/:id/edit', element: <CustomerEditPage /> },
          { path: '/admin/users/:id/qr', element: <CustomerQrPage /> },
        ],
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
