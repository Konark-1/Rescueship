import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', style, ...props }, ref) => {
    const variantStyle: React.CSSProperties =
      variant === 'default'
        ? { background: 'var(--indigo, #4f46e5)', color: '#fff', border: 'none' }
        : variant === 'secondary'
        ? { background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-1, #f4f4f5)', border: '1px solid var(--border, rgba(255, 255, 255, 0.1))' }
        : variant === 'outline'
        ? { background: 'transparent', color: 'var(--text-1, #f4f4f5)', border: '1px solid var(--border, rgba(255, 255, 255, 0.15))' }
        : variant === 'ghost'
        ? { background: 'transparent', color: 'var(--text-2, #d4d4d8)', border: 'none' }
        : variant === 'danger'
        ? { background: 'var(--danger, #ef4444)', color: '#fff', border: 'none' }
        : { background: 'transparent', color: 'var(--indigo-soft, #818cf8)', border: 'none', padding: 0 };

    const sizeStyle: React.CSSProperties =
      size === 'sm'
        ? { padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }
        : size === 'lg'
        ? { padding: '12px 24px', fontSize: '1rem', borderRadius: '10px' }
        : size === 'icon'
        ? { width: '36px', height: '36px', padding: 0, borderRadius: '8px' }
        : { padding: '8px 16px', fontSize: '0.875rem', borderRadius: '8px' };

    return (
      <button
        ref={ref}
        className={cn('inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none', className)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          ...variantStyle,
          ...sizeStyle,
          ...style,
        }}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
