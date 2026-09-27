import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'error' | 'success' | 'info' | 'warning';

const STYLES: Record<Tone, string> = {
  error: 'bg-danger-soft text-danger-soft-fg',
  success: 'bg-success-soft text-success-soft-fg',
  info: 'bg-primary-soft text-primary-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
};

const ICONS = { error: XCircle, success: CheckCircle2, info: Info, warning: AlertTriangle };

interface AlertProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg p-3 text-sm', STYLES[tone], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
