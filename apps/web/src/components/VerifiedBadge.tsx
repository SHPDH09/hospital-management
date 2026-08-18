interface VerifiedBadgeProps {
  verified?: boolean;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function VerifiedBadge({ verified = false, label = 'Verified', className = '', size = 'sm' }: VerifiedBadgeProps) {
  if (!verified) return null;
  const sizeClass = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-green-50 text-green-700 font-medium ${sizeClass} ${className}`}>
      <span aria-hidden>✓</span>
      {label}
    </span>
  );
}
