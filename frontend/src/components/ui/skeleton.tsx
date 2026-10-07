import * as React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-white/10 skeleton', className)}
      style={{
        borderRadius: '8px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        ...style,
      }}
      {...props}
    />
  );
}
