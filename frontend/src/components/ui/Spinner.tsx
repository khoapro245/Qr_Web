import { cn } from '../../lib/cn';

const SIZES = { sm: 'size-4', md: 'size-6', lg: 'size-10' } as const;

/** Decorative spinner; pair it with visible or screen-reader text describing what loads. */
export function Spinner({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', SIZES[size], className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FullPageSpinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center gap-3 text-fg-muted">
      <Spinner size="lg" className="text-primary" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
