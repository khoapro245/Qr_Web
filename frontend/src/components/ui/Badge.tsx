import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'success' | 'neutral' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  success: 'bg-success-soft text-success-soft-fg',
  neutral: 'bg-surface-muted text-fg-muted',
  danger: 'bg-danger-soft text-danger-soft-fg',
  info: 'bg-primary-soft text-primary-soft-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
