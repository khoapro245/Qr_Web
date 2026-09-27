import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useTheme, type ThemePreference } from '../../lib/theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Giao diện sáng', Icon: Sun },
  { value: 'dark', label: 'Giao diện tối', Icon: Moon },
  { value: 'system', label: 'Theo hệ thống', Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Chế độ giao diện"
      className={cn('inline-flex rounded-lg border border-border bg-surface p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors',
            theme === value ? 'bg-primary-soft text-primary-soft-fg' : 'hover:text-fg',
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  );
}
