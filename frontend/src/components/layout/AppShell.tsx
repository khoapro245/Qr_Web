import { KeyRound, LayoutDashboard, LogOut, Menu, UserRound, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth, useLogout } from '../../features/auth/use-auth';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV: Record<'admin' | 'customer', NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Tổng quan', Icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Khách hàng', Icon: Users },
  ],
  customer: [{ to: '/profile', label: 'Hồ sơ của tôi', Icon: UserRound }],
};

export function AppShell({ area }: { area: 'admin' | 'customer' }) {
  const { user } = useAuth();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const home = area === 'admin' ? '/admin' : '/profile';

  const navLinks = NAV[area].map(({ to, label, Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-soft text-primary-soft-fg'
            : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
        )
      }
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </NavLink>
  ));

  const accountActions = (
    <>
      <Link
        to="/change-password"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        <KeyRound aria-hidden="true" className="size-4" />
        Đổi mật khẩu
      </Link>
      <Button variant="ghost" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
        <LogOut aria-hidden="true" className="size-4" />
        Đăng xuất
      </Button>
    </>
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Bỏ qua điều hướng
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to={home} aria-label="QR Care — trang chủ">
            <Logo />
          </Link>
          <nav aria-label="Điều hướng chính" className="hidden flex-1 items-center gap-1 md:flex">
            {navLinks}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="max-w-48 truncate text-sm text-fg-muted" title={user?.displayName}>
              {user?.displayName}
            </span>
            <ThemeToggle />
            {accountActions}
          </div>
          <button
            type="button"
            className="ml-auto flex size-10 items-center justify-center rounded-lg text-fg hover:bg-surface-muted md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        {menuOpen && (
          <div id="mobile-menu" className="space-y-3 border-t border-border px-4 py-3 md:hidden">
            <p className="truncate text-sm text-fg-muted">{user?.displayName}</p>
            <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
              {navLinks}
            </nav>
            <div className="flex flex-col items-start gap-1">{accountActions}</div>
            <ThemeToggle />
          </div>
        )}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
