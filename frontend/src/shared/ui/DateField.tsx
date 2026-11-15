import { faCalendarDays, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useRef, useState } from 'react';
import { TextField } from './TextField';

type DateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const months = Array.from({ length: 12 }, (_, month) =>
  new Date(2000, month, 1).toLocaleDateString('en-US', { month: 'long' }),
);

export function DateField({ id, label, value, onChange, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const trigger = useRef<HTMLButtonElement>(null);
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const show = () => {
    if (open) return setOpen(false);
    const selected = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
    const valid =
      Number.isFinite(selected.getTime()) &&
      selected.getFullYear() >= 1900 &&
      selected.getFullYear() <= 2100;
    const date = valid ? selected : new Date();
    setMonth(date.getMonth());
    setYear(date.getFullYear());
    setOpen(true);
  };
  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <TextField
        id={id}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="YYYY-MM-DD"
        error={error}
        className="pr-12"
        onClick={() => {
          if (!open) show();
        }}
      />
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose ${label.toLowerCase()}`}
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
        onClick={show}
        className="absolute right-1 top-7 inline-flex size-10 items-center justify-center rounded-control text-primary hover:bg-selection focus-visible:outline-2 focus-visible:outline-primary"
      >
        <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-calendar`}
          role="group"
          aria-label={`${label} calendar`}
          onMouseDown={(event) => event.preventDefault()}
          className="ml-auto mt-2 w-64 max-w-full overflow-hidden rounded-control border border-border bg-white font-sans text-text-primary shadow-lg"
        >
          <div className="bg-primary px-2 py-2 text-white">
            <p className="mb-1 text-ui-xs font-medium opacity-80">{label}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                disabled={year === 1900 && month === 0}
                onClick={() => moveMonth(-1)}
                className="size-7 shrink-0 rounded-control hover:bg-white/15 disabled:opacity-30"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <select
                aria-label="Month"
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="min-w-0 flex-1 rounded-control bg-primary py-1 text-ui-sm font-semibold"
              >
                {months.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="rounded-control bg-primary py-1 text-ui-sm font-semibold"
              >
                {Array.from({ length: 201 }, (_, index) => 1900 + index).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next month"
                disabled={year === 2100 && month === 11}
                onClick={() => moveMonth(1)}
                className="size-7 shrink-0 rounded-control hover:bg-white/15 disabled:opacity-30"
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 p-2 text-center text-ui-xs">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <span key={day} className="py-1 text-ui-xs font-semibold text-text-secondary">
                {day}
              </span>
            ))}
            {Array.from({ length: firstDay }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: dayCount }, (_, index) => {
              const day = index + 1;
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={iso}
                  aria-pressed={value === iso}
                  onClick={() => {
                    onChange(iso);
                    close();
                  }}
                  className={`h-7 rounded-control font-medium focus-visible:outline-2 focus-visible:outline-primary ${value === iso ? 'bg-primary text-white' : 'hover:bg-selection hover:text-primary'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
