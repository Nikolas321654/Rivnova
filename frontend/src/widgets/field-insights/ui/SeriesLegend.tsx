import { seriesMeta, type SeriesKey } from '../model/series';

type SeriesLegendProps = {
  series: SeriesKey[];
  hidden: Set<SeriesKey>;
  onToggle: (key: SeriesKey) => void;
  onHighlight: (keys: SeriesKey[] | null) => void;
};

export function SeriesLegend({ series, hidden, onToggle, onHighlight }: SeriesLegendProps) {
  return (
    <div role="group" aria-label="Chart series" className="flex flex-wrap gap-1.5">
      {series.map((key) => {
        const meta = seriesMeta[key];
        const visible = !hidden.has(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={visible}
            onClick={() => onToggle(key)}
            onMouseEnter={() => visible && onHighlight([key])}
            onMouseLeave={() => onHighlight(null)}
            onFocus={() => visible && onHighlight([key])}
            onBlur={() => onHighlight(null)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-badge border px-2.5 text-ui-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${visible ? 'border-border bg-surface text-text-primary hover:border-primary/40' : 'border-dashed border-border bg-transparent text-text-secondary/70 hover:text-text-secondary'}`}
          >
            <span
              aria-hidden="true"
              className={meta.kind === 'bar' ? 'h-2.5 w-2 rounded-sm' : 'h-0.5 w-3.5 rounded-full'}
              style={{
                backgroundColor: visible ? meta.color : 'currentColor',
                ...(meta.kind === 'forecast'
                  ? {
                      background: `repeating-linear-gradient(90deg, ${visible ? meta.color : 'currentColor'} 0 4px, transparent 4px 7px)`,
                    }
                  : {}),
              }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
