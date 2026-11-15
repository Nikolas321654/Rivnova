import { recentRainLabel, type FieldDashboard, type WorkabilityWindow } from '@/entities/field';
import { withoutLongDashes } from '@/shared/lib/text';
import { Metric } from './Metric';

type WorkabilitySectionProps = {
  dashboard: FieldDashboard;
  window: WorkabilityWindow | undefined;
  windowState: 'pending' | 'error' | 'success';
  onRetryWindow: () => void;
};

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function forecastValue(mm: number | null | undefined): string {
  return mm === null || mm === undefined ? 'n/a' : oneDecimal.format(mm);
}

function forecastHint(source: string | null | undefined, mm: number | null | undefined): string {
  if (mm === null || mm === undefined) return 'Forecast unavailable';
  if (source === 'MOCK_FIXTURE') return 'Sample forecast';
  if (source === 'OPEN_METEO_FORECAST') return 'Open-Meteo forecast';
  return 'Weather forecast';
}

export function WorkabilitySection({
  dashboard,
  window,
  windowState,
  onRetryWindow,
}: WorkabilitySectionProps) {
  const workability = dashboard.workability;

  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric
          label="Rain, 12h"
          value={
            workability.rainLast12hMm === null || workability.rainLast12hMm === undefined
              ? 'n/a'
              : oneDecimal.format(workability.rainLast12hMm)
          }
          unit={typeof workability.rainLast12hMm === 'number' ? 'mm' : undefined}
          hint={
            typeof workability.rainLast12hMm === 'number'
              ? recentRainLabel(workability.recentRainSource)
              : 'Not available, check locally'
          }
        />
        <Metric
          label="Rain, 24h"
          value={
            workability.rainLast24hMm === null || workability.rainLast24hMm === undefined
              ? 'n/a'
              : oneDecimal.format(workability.rainLast24hMm)
          }
          unit={typeof workability.rainLast24hMm === 'number' ? 'mm' : undefined}
          hint={
            typeof workability.rainLast24hMm === 'number'
              ? recentRainLabel(workability.recentRainSource)
              : 'Not available, check locally'
          }
        />
        <Metric label="Surface moisture" value={workability.surfaceMoisture.toFixed(2)} />
        <Metric
          label="Rain forecast, 24h"
          value={forecastValue(workability.rainForecast24hMm)}
          unit={
            workability.rainForecast24hMm === null || workability.rainForecast24hMm === undefined
              ? undefined
              : 'mm'
          }
          hint={forecastHint(workability.forecastSource, workability.rainForecast24hMm)}
        />
        <Metric
          label="Rain forecast, 24-48h"
          value={forecastValue(workability.rainForecast24To48hMm)}
          unit={
            workability.rainForecast24To48hMm === null ||
            workability.rainForecast24To48hMm === undefined
              ? undefined
              : 'mm'
          }
          hint={forecastHint(workability.forecastSource, workability.rainForecast24To48hMm)}
        />
      </dl>
      {windowState === 'error' && (
        <p role="alert" className="text-ui-xs text-text-secondary">
          48h periods unavailable.{' '}
          <button
            type="button"
            onClick={onRetryWindow}
            className="font-medium text-primary hover:underline"
          >
            Retry
          </button>
        </p>
      )}
      {window && (
        <ul className="grid gap-0.5 text-ui-xs text-text-secondary">
          {window.forecast48h.map((period) => (
            <li key={period.period}>
              <span className="font-medium text-text-primary">
                {withoutLongDashes(period.period)}
              </span>
              {`: ${withoutLongDashes(period.reason)}`}
            </li>
          ))}
        </ul>
      )}
      <p className="text-ui-xs text-text-secondary">{workability.recommendation}</p>
    </div>
  );
}
