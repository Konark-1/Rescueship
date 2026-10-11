import React from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange, label?: string) => void;
  activePreset?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ onChange, activePreset = 'This Month' }) => {
  const handleSelectOption = (days: number, label: string) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    onChange(
      {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      label
    );
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
        onClick={() => handleSelectOption(1, 'Today')}
        style={{
          fontSize: '0.78rem',
          height: '28px',
          padding: '0 10px',
          borderRadius: 'var(--radius-md, 8px)',
          background: activePreset === 'Today' ? 'var(--indigo-15)' : undefined,
          color: activePreset === 'Today' ? 'var(--indigo-soft)' : undefined,
        }}
      >
        Today
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => handleSelectOption(7, 'Last 7 Days')}
        style={{
          fontSize: '0.78rem',
          height: '28px',
          padding: '0 10px',
          borderRadius: 'var(--radius-md, 8px)',
          background: activePreset === 'Last 7 Days' ? 'var(--indigo-15)' : undefined,
          color: activePreset === 'Last 7 Days' ? 'var(--indigo-soft)' : undefined,
        }}
      >
        7 Days
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => handleSelectOption(30, 'Last 30 Days')}
        style={{
          fontSize: '0.78rem',
          height: '28px',
          padding: '0 10px',
          borderRadius: 'var(--radius-md, 8px)',
          background: activePreset === 'Last 30 Days' || activePreset === 'This Month' ? 'var(--indigo-15)' : undefined,
          color: activePreset === 'Last 30 Days' || activePreset === 'This Month' ? 'var(--indigo-soft)' : undefined,
        }}
      >
        30 Days
      </button>
    </div>
  );
};
