import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  verified?: boolean;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function VerifiedBadge({ verified = false, label = 'Verified', className, size = 'sm' }: VerifiedBadgeProps) {
  if (!verified) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 font-medium',
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
      className,
    )}>
      <ShieldCheck className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </span>
  );
}
