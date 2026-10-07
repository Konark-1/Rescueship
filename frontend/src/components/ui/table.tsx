import * as React from 'react';
import { cn } from '../../lib/utils';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      className="relative w-full overflow-auto table-container"
      style={{ width: '100%', overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))' }}
    >
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm custom-table', className)}
        style={{ width: '100%', borderCollapse: 'collapse', ...style }}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b border-white/10', className)} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('bg-white/[0.02] font-medium text-white', className)} {...props} />
  )
);
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, style, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-white/10 transition-colors hover:bg-white/[0.03]', className)}
      style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', ...style }}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, style, ...props }, ref) => (
    <th
      ref={ref}
      className={cn('h-10 px-4 text-left align-middle font-medium text-neutral-400 [&:has([role=checkbox])]:pr-0', className)}
      style={{
        padding: '12px 16px',
        textAlign: 'left',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-3, #9ca3af)',
        background: 'rgba(255, 255, 255, 0.02)',
        ...style,
      }}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, style, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('p-4 align-middle text-white [&:has([role=checkbox])]:pr-0', className)}
      style={{ padding: '12px 16px', verticalAlign: 'middle', ...style }}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, style, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn('mt-4 text-sm text-neutral-400', className)}
      style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-3, #9ca3af)', ...style }}
      {...props}
    />
  )
);
TableCaption.displayName = 'TableCaption';
