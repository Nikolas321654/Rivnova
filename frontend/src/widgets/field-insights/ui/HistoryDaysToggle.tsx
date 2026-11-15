import { historyDayOptions, type HistoryDays } from '../model/history';

type HistoryDaysToggleProps = {
  value: HistoryDays;
  onChange: (days: HistoryDays) => void;
};

export function HistoryDaysToggle({ value, onChange }: HistoryDaysToggleProps) {
  return (
    <div
      role="group"
      aria-label="History period"
      className="flex gap-1 rounded-control bg-surface-muted p-1"
    >
      {historyDayOptions.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => onChange(days)}
          className={`min-h-9 rounded-control px-3 text-ui-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${value === days ? 'bg-selection text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          {days === 'season' ? 'This season' : `${days} days`}
        </button>
      ))}
    </div>
  );
}
