import { ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';

type AnimateInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
};

const hiddenTransform: Record<NonNullable<AnimateInProps['direction']>, string> = {
  up: 'translate-y-8',
  down: '-translate-y-8',
  left: 'translate-x-8',
  right: '-translate-x-8',
  none: '',
};

export function AnimateIn({ children, className = '', delay = 0, direction = 'up' }: AnimateInProps) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:transform-none ${
        inView ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${hiddenTransform[direction]}`
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
