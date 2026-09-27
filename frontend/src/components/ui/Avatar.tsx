import { useState } from 'react';
import { cn } from '../../lib/cn';

const SIZES = {
  sm: 'size-10 text-base',
  md: 'size-16 text-2xl',
  lg: 'size-24 text-3xl',
  xl: 'size-32 text-5xl',
} as const;

/** Vietnamese names put the given name last, so show its first letter. */
function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] ?? '').charAt(0).toUpperCase() || '?';
}

interface AvatarProps {
  src: string | null;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Profile photo with an initial-letter fallback when there is no photo or it fails to load. */
export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const classes = cn('shrink-0 rounded-full', SIZES[size], className);

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={`Ảnh đại diện của ${name}`}
        className={cn(classes, 'bg-surface-muted object-cover')}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${name} chưa có ảnh đại diện`}
      className={cn(
        classes,
        'flex items-center justify-center bg-primary-soft font-semibold text-primary-soft-fg',
      )}
    >
      <span aria-hidden="true">{initialOf(name)}</span>
    </div>
  );
}
