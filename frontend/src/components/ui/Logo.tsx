import anmoveLogo from '../../assets/anmove-logo.png';
import { cn } from '../../lib/cn';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-7 sm:h-8',
    lg: 'h-10 sm:h-12',
  }[size];

  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src={anmoveLogo}
        alt="Anmove"
        className={cn('w-auto object-contain select-none', sizeClasses)}
      />
    </span>
  );
}
