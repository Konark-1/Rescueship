import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, style, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        ref={ref}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled && onCheckedChange) {
            onCheckedChange(!checked);
          }
        }}
        className={cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{
          position: 'relative',
          display: 'inline-flex',
          height: '20px',
          width: '36px',
          flexShrink: 0,
          borderRadius: '9999px',
          border: '2px solid transparent',
          backgroundColor: checked ? 'var(--indigo, #4f46e5)' : 'rgba(255, 255, 255, 0.16)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: disabled ? 0.5 : 1,
          padding: 0,
          outline: 'none',
          ...style,
        }}
        {...props}
      >
        <span
          className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform"
          style={{
            display: 'block',
            height: '16px',
            width: '16px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
            transform: checked ? 'translateX(16px)' : 'translateX(0px)',
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';
export default Switch;
