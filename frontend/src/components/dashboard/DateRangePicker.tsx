import React from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ onChange }) => {
  const handleSelectOption = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    onChange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '3px',
        gap: '4px',
      }}
    >
      <div style={{ padding: '0 8px', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
        <Calendar size={14} />
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => handleSelectOption(1)}
        style={{ fontSize: '0.78rem', height: '28px', padding: '0 10px', borderRadius: 'var(--radius-md, 8px)' }}
      >
        Today
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => handleSelectOption(7)}
        style={{ fontSize: '0.78rem', height: '28px', padding: '0 10px', borderRadius: 'var(--radius-md, 8px)' }}
      >
        7 Days
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => handleSelectOption(30)}
        style={{
          fontSize: '0.78rem',
          height: '28px',
          padding: '0 10px',
          borderRadius: 'var(--radius-md, 8px)',
          background: 'var(--indigo-15)',
          color: 'var(--indigo-soft)',
        }}
      >
        30 Days
      </button>
    </div>
  );
};
