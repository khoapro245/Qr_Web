import { HeartPulse } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold text-fg', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <HeartPulse aria-hidden="true" className="size-5" />
      </span>
      QR Care
    </span>
  );
}
