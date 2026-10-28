import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  isToday,
  differenceInCalendarDays,
} from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface BentoDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange, label?: string) => void;
  activePreset?: string;
  compactTrigger?: boolean;
}

const PRESETS = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
] as const;

function CalendarGrid({
  month,
  rangeStart,
  rangeEnd,
  hoverDate,
  onDateClick,
  onDateHover,
  today,
}: {
  month: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  hoverDate: Date | null;
  onDateClick: (d: Date) => void;
  onDateHover: (d: Date | null) => void;
  today: Date;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  // Determine visual range for highlighting
  const effectiveEnd = rangeEnd || hoverDate;
  let rStart = rangeStart;
  let rEnd = effectiveEnd;
  if (rStart && rEnd && isAfter(rStart, rEnd)) {
    [rStart, rEnd] = [rEnd, rStart];
  }

  return (
    <div className="flex flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div
            key={d}
            className="h-7 flex items-center justify-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((d, di) => {
            const inMonth = isSameMonth(d, month);
            const isStart = rStart && isSameDay(d, rStart);
            const isEnd = rEnd && isSameDay(d, rEnd);
            const inRange =
              rStart && rEnd && isAfter(d, rStart) && isBefore(d, rEnd);
            const isTodayDate = isToday(d);
            const isFuture = isAfter(d, today);

            return (
              <button
                key={di}
                type="button"
                disabled={isFuture || !inMonth}
                onClick={() => !isFuture && inMonth && onDateClick(d)}
                onMouseEnter={() => inMonth && !isFuture && onDateHover(d)}
                onMouseLeave={() => onDateHover(null)}
                className={`
                  h-8 w-full flex items-center justify-center text-xs font-medium
                  transition-all duration-100 relative
                  ${!inMonth ? 'text-zinc-700 cursor-default' : ''}
                  ${inMonth && !isFuture ? 'cursor-pointer hover:bg-white/10' : ''}
                  ${isFuture && inMonth ? 'text-zinc-700 cursor-not-allowed' : ''}
                  ${inMonth && !isStart && !isEnd && !inRange ? 'text-zinc-300' : ''}
                  ${inRange ? 'bg-indigo-500/15 text-indigo-200' : ''}
                  ${isStart ? 'bg-indigo-500 text-white rounded-l-lg font-bold' : ''}
                  ${isEnd ? 'bg-indigo-500 text-white rounded-r-lg font-bold' : ''}
                  ${isStart && isEnd ? 'rounded-lg' : ''}
                  ${isTodayDate && !isStart && !isEnd ? 'ring-1 ring-indigo-400/50 rounded-md' : ''}
                `}
              >
                {format(d, 'd')}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const BentoDateRangePicker: React.FC<BentoDateRangePickerProps> = ({
  value,
  onChange,
  activePreset = 'Last 30 Days',
  compactTrigger = false,
}) => {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const today = useMemo(() => new Date(), []);

  // Two-month display
  const [leftMonth, setLeftMonth] = useState(() => subMonths(today, 1));
  const rightMonth = useMemo(() => addMonths(leftMonth, 1), [leftMonth]);

  useEffect(() => {
    if (open && value?.startDate) {
      try {
        const s = new Date(value.startDate);
        const e = value.endDate ? new Date(value.endDate) : s;
        setTempStart(s);
        setTempEnd(e);
        // Position calendar to show the range
        setLeftMonth(subMonths(e, 1));
      } catch {
        // fallback
      }
      setSelecting('start');
    }
  }, [open, value]);

  const handlePreset = (days: number, label: string) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    onChange({ startDate: start.toISOString(), endDate: end.toISOString() }, label);
    setOpen(false);
  };

  const handleDateClick = (d: Date) => {
    if (selecting === 'start') {
      setTempStart(d);
      setTempEnd(null);
      setSelecting('end');
    } else {
      let start = tempStart!;
      let end = d;
      if (isAfter(start, end)) {
        [start, end] = [end, start];
      }
      setTempEnd(end);
      setSelecting('start');

      // Apply the range
      const days = differenceInCalendarDays(end, start) + 1;
      const rangeLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d')} (${days}d)`;
      onChange(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        rangeLabel
      );
      setOpen(false);
    }
  };

  // Display label
  const displayLabel = useMemo(() => {
    if (activePreset && !activePreset.startsWith('Custom')) {
      return activePreset;
    }
    try {
      const s = new Date(value.startDate);
      const e = new Date(value.endDate);
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
    } catch {
      return 'Select dates';
    }
  }, [value, activePreset]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            compactTrigger
              ? 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer'
              : 'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/20 transition-all cursor-pointer'
          }
        >
          <Calendar size={13} className="text-indigo-400" />
          <span className="font-mono">{displayLabel}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent side="bottom" align="end" sideOffset={8} className="w-auto">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Select date range</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePreset(p.days, p.label)}
                className={`
                  px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer
                  ${activePreset === p.label
                    ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-400 border border-white/5 hover:text-zinc-200 hover:bg-zinc-800'
                  }
                `}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Selection hint */}
          <div className="text-[10.5px] text-zinc-500 mb-3 font-medium">
            {selecting === 'start' ? (
              <span>Click to set <span className="text-indigo-400">check-in</span> date</span>
            ) : (
              <span>Click to set <span className="text-emerald-400">check-out</span> date</span>
            )}
          </div>

          {/* Two-month calendar */}
          <div className="flex gap-6">
            {/* Left month */}
            <div className="w-[220px]">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setLeftMonth(subMonths(leftMonth, 1))}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-zinc-200">
                  {format(leftMonth, 'MMMM yyyy')}
                </span>
                <div className="w-6" />
              </div>
              <CalendarGrid
                month={leftMonth}
                rangeStart={tempStart}
                rangeEnd={tempEnd}
                hoverDate={selecting === 'end' ? hoverDate : null}
                onDateClick={handleDateClick}
                onDateHover={setHoverDate}
                today={today}
              />
            </div>

            {/* Right month */}
            <div className="w-[220px]">
              <div className="flex items-center justify-between mb-2">
                <div className="w-6" />
                <span className="text-xs font-semibold text-zinc-200">
                  {format(rightMonth, 'MMMM yyyy')}
                </span>
                <button
                  type="button"
                  onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
                  disabled={isSameMonth(rightMonth, today)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <CalendarGrid
                month={rightMonth}
                rangeStart={tempStart}
                rangeEnd={tempEnd}
                hoverDate={selecting === 'end' ? hoverDate : null}
                onDateClick={handleDateClick}
                onDateHover={setHoverDate}
                today={today}
              />
            </div>
          </div>

          {/* Footer with selected range */}
          {tempStart && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="text-[11px] text-zinc-400">
                <span className="text-indigo-300 font-mono font-medium">
                  {format(tempStart, 'MMM d, yyyy')}
                </span>
                {tempEnd && (
                  <>
                    <span className="mx-1.5 text-zinc-600">→</span>
                    <span className="text-emerald-300 font-mono font-medium">
                      {format(tempEnd, 'MMM d, yyyy')}
                    </span>
                  </>
                )}
              </div>
              {tempStart && !tempEnd && (
                <button
                  type="button"
                  onClick={() => {
                    setTempStart(null);
                    setSelecting('start');
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default BentoDateRangePicker;
