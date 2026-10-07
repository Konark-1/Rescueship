import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      backdropFilter: 'blur(4px)',
      ...style,
    }}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-white/10 bg-[#0d0e17] p-6 shadow-2xl duration-200 sm:rounded-2xl',
        className
      )}
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 51,
        width: '92vw',
        maxWidth: '560px',
        maxHeight: '88vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-deep, #0a0a10)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        borderRadius: 'var(--radius-xl, 20px)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
        padding: '24px',
        color: 'var(--text-1, #f4f4f5)',
        ...style,
      }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
        style={{
          position: 'absolute',
          right: '16px',
          top: '16px',
          background: 'none',
          border: 'none',
          color: 'var(--text-3, #9ca3af)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
        }}
        aria-label="Close"
      >
        <X size={18} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
    style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', ...style }}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', ...style }}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-white', className)}
    style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-1, #f4f4f5)', ...style }}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-neutral-400', className)}
    style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-3, #9ca3af)', ...style }}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
