import { formatObservationDate } from '@/entities/field';
import { seriesMeta, seriesOrder, type DayValues, type SeriesKey } from '../model/series';

type DayTooltipProps = {
  active?: boolean;
  label?: string | number;
  lookup: Map<string, DayValues>;
  hidden: Set<SeriesKey>;
};

export function DayTooltip({ active, label, lookup, hidden }: DayTooltipProps) {
  if (!active || label === undefined) return null;
  const date = String(label);
  const values = lookup.get(date);
  if (!values) return null;
  const rows = seriesOrder.filter((key) => !hidden.has(key) && values[key] !== undefined);
  if (rows.length === 0) return null;

  return (
    <div className="min-w-44 rounded-control border border-border bg-surface px-3 py-2 text-ui-xs shadow-lg">
      <p className="mb-1 font-semibold text-text-primary">
        {formatObservationDate(date)}
        {values.forecastRootzoneMoisture !== undefined && (
          <span className="ml-1.5 font-normal text-text-secondary">model forecast</span>
        )}
      </p>
      <dl className="grid gap-0.5">
        {rows.map((key) => {
          const meta = seriesMeta[key];
          const value = values[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden="true"
                />
                {meta.label}
              </dt>
              <dd className="tabular-nums text-text-primary">
                {typeof value === 'number'
                  ? `${value.toFixed(meta.digits)}${meta.unit ? ` ${meta.unit}` : ''}`
                  : 'No data'}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
