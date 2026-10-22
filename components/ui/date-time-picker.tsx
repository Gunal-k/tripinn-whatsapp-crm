'use client';

import React, { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import { Calendar, Clock, X } from 'lucide-react';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import type { BaseOptions } from 'flatpickr/dist/types/options';

export interface DateTimePickerProps {
  value?: string | null;
  onChange: (dateStr: string) => void;
  enableTime?: boolean;
  mode?: 'single' | 'range' | 'multiple';
  placeholder?: string;
  minDate?: string | Date;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  allowClear?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  enableTime = true,
  mode = 'single',
  placeholder = 'Select date & time...',
  minDate,
  disabled = false,
  className = '',
  id,
  name,
  required = false,
  allowClear = true,
}: DateTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpInstanceRef = useRef<FlatpickrInstance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    const options: Partial<BaseOptions> = {
      enableTime,
      mode,
      dateFormat: enableTime ? 'Z' : 'Y-m-d', // Store as ISO timestamp or Y-m-d
      altInput: true,
      altFormat: enableTime ? 'M j, Y • h:i K' : 'M j, Y',
      altInputClass: `w-full px-3 py-2 pl-9 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition cursor-pointer disabled:opacity-50 ${className}`,
      minDate,
      time_24hr: false,
      defaultDate: value || undefined,
      onChange: (selectedDates, dateStr) => {
        if (selectedDates.length === 0) {
          onChange('');
        } else if (enableTime && selectedDates[0]) {
          onChange(selectedDates[0].toISOString());
        } else {
          onChange(dateStr);
        }
      },
    };

    const fp = flatpickr(inputRef.current, options);
    fpInstanceRef.current = fp;

    return () => {
      fp.destroy();
      fpInstanceRef.current = null;
    };
  }, [enableTime, mode, minDate]); // Reinit if mode or enableTime changes

  // Sync external value changes into flatpickr instance
  useEffect(() => {
    if (fpInstanceRef.current) {
      const currentDates = fpInstanceRef.current.selectedDates;
      const currentIso = currentDates[0]?.toISOString();
      if (value) {
        if (currentIso !== value && fpInstanceRef.current.input.value !== value) {
          fpInstanceRef.current.setDate(value, false);
        }
      } else if (currentDates.length > 0) {
        fpInstanceRef.current.clear(false);
      }
    }
  }, [value]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (fpInstanceRef.current) {
      fpInstanceRef.current.clear(true);
    }
    onChange('');
  };

  return (
    <div className="relative flex items-center w-full">
      {/* Leading Icon */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10">
        {enableTime ? (
          <Clock className="w-4 h-4 text-emerald-400/80" />
        ) : (
          <Calendar className="w-4 h-4 text-emerald-400/80" />
        )}
      </div>

      {/* Hidden real input bound to flatpickr */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        defaultValue={value || ''}
        className="hidden"
      />

      {/* Trailing Clear Button */}
      {allowClear && Boolean(value) && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition z-10 cursor-pointer"
          title="Clear date"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Global Flatpickr Theme Styles Guarantee */}
      <style dangerouslySetInnerHTML={{ __html: FLATPICKR_THEME_CSS }} />
    </div>
  );
}

const FLATPICKR_THEME_CSS = `
/* Flatpickr Dark Theme (Default) */
.flatpickr-calendar {
  background: #0b132b !important;
  border: 1px solid #1e293b !important;
  border-radius: 0.875rem !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4) !important;
  font-family: inherit !important;
  overflow: hidden;
  z-index: 99999 !important;
}

.flatpickr-calendar.arrowTop:before,
.flatpickr-calendar.arrowTop:after {
  border-bottom-color: #0b132b !important;
}
.flatpickr-calendar.arrowBottom:before,
.flatpickr-calendar.arrowBottom:after {
  border-top-color: #0b132b !important;
}

.flatpickr-months {
  background: #070d1a !important;
  border-bottom: 1px solid #1e293b !important;
  padding: 6px 0 !important;
}
.flatpickr-months .flatpickr-month {
  color: #f1f5f9 !important;
  fill: #f1f5f9 !important;
}
.flatpickr-current-month {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: #f1f5f9 !important;
}
.flatpickr-current-month .flatpickr-monthDropdown-months {
  background: transparent !important;
  color: #f1f5f9 !important;
  font-weight: 700 !important;
}
.flatpickr-current-month .flatpickr-monthDropdown-months .flatpickr-monthDropdown-month {
  background-color: #0b132b !important;
  color: #f1f5f9 !important;
}
.flatpickr-current-month input.cur-year {
  color: #f1f5f9 !important;
  font-weight: 700 !important;
}
.flatpickr-current-month input.cur-year:focus {
  background: #111d3d !important;
  border-radius: 4px !important;
}
.flatpickr-months .flatpickr-prev-month,
.flatpickr-months .flatpickr-next-month {
  color: #10b981 !important;
  fill: #10b981 !important;
  padding: 8px !important;
}
.flatpickr-months .flatpickr-prev-month:hover svg,
.flatpickr-months .flatpickr-next-month:hover svg {
  fill: #34d399 !important;
}

span.flatpickr-weekday {
  color: #94a3b8 !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  background: transparent !important;
}

.flatpickr-day {
  color: #e2e8f0 !important;
  border-radius: 0.5rem !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  border-color: transparent !important;
  transition: all 0.15s ease-in-out;
}
.flatpickr-day:hover {
  background: #111d3d !important;
  border-color: #334155 !important;
  color: #ffffff !important;
}
.flatpickr-day.today {
  border-color: #10b981 !important;
  color: #34d399 !important;
}
.flatpickr-day.selected,
.flatpickr-day.startRange,
.flatpickr-day.endRange {
  background: #10b981 !important;
  border-color: #10b981 !important;
  color: #070d1a !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3) !important;
}
.flatpickr-day.prevMonthDay,
.flatpickr-day.nextMonthDay {
  color: #475569 !important;
}

/* Time Picker Container */
.flatpickr-time {
  background: #070d1a !important;
  border-top: 1px solid #1e293b !important;
  line-height: 40px !important;
  height: 40px !important;
  max-height: 40px !important;
  padding: 0 6px !important;
}

/* All inputs and wrappers inside time picker */
.flatpickr-time .numInputWrapper,
.flatpickr-time .numInputWrapper:hover,
.flatpickr-time .numInputWrapper:focus,
.flatpickr-time .numInputWrapper:active {
  background: transparent !important;
  border-radius: 6px !important;
}

.flatpickr-time input,
.flatpickr-time input.flatpickr-hour,
.flatpickr-time input.flatpickr-minute,
.flatpickr-time input.flatpickr-second,
.flatpickr-time .numInput {
  background: transparent !important;
  color: #f1f5f9 !important;
  font-weight: 700 !important;
  font-size: 13px !important;
  border: 1px solid transparent !important;
  border-radius: 6px !important;
  transition: all 0.15s ease-in-out;
}

.flatpickr-time input:hover,
.flatpickr-time input:focus,
.flatpickr-time input:active,
.flatpickr-time input.flatpickr-hour:hover,
.flatpickr-time input.flatpickr-hour:focus,
.flatpickr-time input.flatpickr-minute:hover,
.flatpickr-time input.flatpickr-minute:focus,
.flatpickr-time .numInput:hover,
.flatpickr-time .numInput:focus {
  background: #111d3d !important;
  color: #10b981 !important;
  border: 1px solid #10b981 !important;
  outline: none !important;
  box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.4) !important;
}

.flatpickr-time input::selection {
  background: #10b981 !important;
  color: #070d1a !important;
}

/* Arrows */
.flatpickr-time .numInputWrapper span,
.flatpickr-time .numInputWrapper span:hover,
.flatpickr-time .numInputWrapper span:active {
  border: none !important;
  background: transparent !important;
}

.flatpickr-time .numInputWrapper span:hover {
  background: rgba(16, 185, 129, 0.2) !important;
}

.flatpickr-time .numInputWrapper span.arrowUp:after {
  border-bottom-color: #10b981 !important;
}

.flatpickr-time .numInputWrapper span.arrowDown:after {
  border-top-color: #10b981 !important;
}

.flatpickr-time .flatpickr-time-separator,
.flatpickr-time .flatpickr-am-pm {
  color: #94a3b8 !important;
  font-weight: 700 !important;
}

.flatpickr-time .flatpickr-am-pm {
  border-radius: 6px !important;
  transition: all 0.15s ease-in-out;
  border: 1px solid transparent !important;
}

.flatpickr-time .flatpickr-am-pm:hover,
.flatpickr-time .flatpickr-am-pm:focus {
  background: #111d3d !important;
  color: #10b981 !important;
  border-color: #10b981 !important;
}

/* Light Mode Overrides */
html.light .flatpickr-calendar,
html[data-theme="light"] .flatpickr-calendar {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
}
html.light .flatpickr-months,
html[data-theme="light"] .flatpickr-months {
  background: #f8fafc !important;
  border-bottom: 1px solid #e2e8f0 !important;
}
html.light .flatpickr-current-month,
html[data-theme="light"] .flatpickr-current-month {
  color: #0f172a !important;
}
html.light .flatpickr-current-month .flatpickr-monthDropdown-months,
html[data-theme="light"] .flatpickr-current-month .flatpickr-monthDropdown-months {
  color: #0f172a !important;
}
html.light .flatpickr-current-month .flatpickr-monthDropdown-months .flatpickr-monthDropdown-month,
html[data-theme="light"] .flatpickr-current-month .flatpickr-monthDropdown-months .flatpickr-monthDropdown-month {
  background-color: #ffffff !important;
  color: #0f172a !important;
}
html.light .flatpickr-current-month input.cur-year,
html[data-theme="light"] .flatpickr-current-month input.cur-year {
  color: #0f172a !important;
}
html.light .flatpickr-day,
html[data-theme="light"] .flatpickr-day {
  color: #1e293b !important;
}
html.light .flatpickr-day:hover,
html[data-theme="light"] .flatpickr-day:hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}
html.light .flatpickr-day.selected,
html[data-theme="light"] .flatpickr-day.selected {
  background: #10b981 !important;
  color: #ffffff !important;
}
html.light .flatpickr-time,
html[data-theme="light"] .flatpickr-time {
  background: #f8fafc !important;
  border-top: 1px solid #e2e8f0 !important;
}
html.light .flatpickr-time input,
html[data-theme="light"] .flatpickr-time input {
  color: #0f172a !important;
}
html.light .flatpickr-time input:hover,
html.light .flatpickr-time input:focus,
html[data-theme="light"] .flatpickr-time input:hover,
html[data-theme="light"] .flatpickr-time input:focus {
  background: #e2e8f0 !important;
  color: #0f172a !important;
  border: 1px solid #10b981 !important;
}
html.light .flatpickr-time .numInputWrapper span.arrowUp:after,
html[data-theme="light"] .flatpickr-time .numInputWrapper span.arrowUp:after {
  border-bottom-color: #059669 !important;
}
html.light .flatpickr-time .numInputWrapper span.arrowDown:after,
html[data-theme="light"] .flatpickr-time .numInputWrapper span.arrowDown:after {
  border-top-color: #059669 !important;
}
html.light .flatpickr-time .flatpickr-am-pm:hover,
html[data-theme="light"] .flatpickr-time .flatpickr-am-pm:hover,
html.light .flatpickr-time .flatpickr-am-pm:focus,
html[data-theme="light"] .flatpickr-time .flatpickr-am-pm:focus {
  background: #e2e8f0 !important;
  color: #059669 !important;
}
`;


