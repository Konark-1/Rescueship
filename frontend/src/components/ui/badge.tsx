import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'secondary';
}

export function Badge({
  className,
  variant = 'default',
  style,
  ...props
}: BadgeProps) {
  const variantStyle: React.CSSProperties =
    variant === 'success'
      ? { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.25)' }
      : variant === 'warning'
      ? { background: 'rgba(251, 191, 36, 0.15)', color: '#fcd34d', border: '1px solid rgba(251, 191, 36, 0.25)' }
      : variant === 'danger'
      ? { background: 'rgba(251, 113, 133, 0.15)', color: '#fda4af', border: '1px solid rgba(251, 113, 133, 0.25)' }
      : variant === 'secondary'
      ? { background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-2, #d4d4d8)', border: '1px solid var(--border, rgba(255, 255, 255, 0.1))' }
      : variant === 'outline'
      ? { background: 'transparent', color: 'var(--text-1, #f4f4f5)', border: '1px solid var(--border, rgba(255, 255, 255, 0.2))' }
      : { background: 'rgba(99, 102, 241, 0.15)', color: 'var(--indigo-soft, #a5b4fc)', border: '1px solid rgba(99, 102, 241, 0.25)' };

  return (
    <div
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors badge', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '0.75rem',
        fontWeight: 600,
        borderRadius: '9999px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...variantStyle,
        ...style,
      }}
      {...props}
    />
  );
}
