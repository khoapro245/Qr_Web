import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from './ThemeToggle';

/** Centered single-card layout for login and password pages. */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
          {description && <div className="mt-2 text-sm text-fg-muted">{description}</div>}
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  );
}
