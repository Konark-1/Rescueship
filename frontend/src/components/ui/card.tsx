import * as React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border border-white/10 bg-white/[0.03] text-white shadow-sm backdrop-blur-md transition-all', className)}
      style={{
        background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-lg, 16px)',
        ...style,
      }}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      style={{ padding: '20px 24px', ...style }}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, style, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight text-white', className)}
      style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-1, #f4f4f5)', ...style }}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, style, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-neutral-400', className)}
      style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-3, #9ca3af)', ...style }}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-6 pt-0', className)}
      style={{ padding: '0 24px 20px 24px', ...style }}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      style={{ padding: '0 24px 20px 24px', display: 'flex', alignItems: 'center', ...style }}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
