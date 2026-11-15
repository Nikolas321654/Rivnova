import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ForecastStatus } from '@/entities/field';
import type { ActionVisualModel } from '../model/actionVisuals';

type ActionVisualProps = {
  visual: ActionVisualModel;
  size?: 'inline' | 'detail';
  decorative?: boolean;
};

const statusDot: Record<ForecastStatus, string> = {
  Optimal: 'bg-status-success',
  Marginal: 'bg-status-warning',
  Blocked: 'bg-status-danger',
  Unknown: 'border border-status-neutral bg-transparent',
};

const box = {
  inline: 'h-5 w-14',
  detail: 'h-10 w-28',
} as const;

function Trend({ values, threshold }: { values: number[]; threshold: number }) {
  const width = 100;
  const height = 30;
  const low = Math.min(...values, threshold);
  const high = Math.max(...values, threshold);
  const pad = Math.max((high - low) * 0.15, 0.02);
  const min = low - pad;
  const max = high + pad;
  const x = (index: number) => (index / (values.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / (max - min)) * height;
  const path = values
    .map(
      (value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
    )
    .join(' ');
  const peak = values.indexOf(Math.max(...values));
  const crosses = values[peak] > threshold;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="size-full overflow-visible"
    >
      <line
        x1="0"
        x2={width}
        y1={y(threshold)}
        y2={y(threshold)}
        className="stroke-status-warning/60"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        className="stroke-navy"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {crosses && (
        <circle
          cx={x(peak)}
          cy={y(values[peak])}
          r="2.5"
          className="fill-status-warning stroke-surface"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function Meter({ value, threshold }: { value: number; threshold: number }) {
  const share = (amount: number) => `${Math.min(Math.max(amount, 0), 1) * 100}%`;
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-border/60">
      <span
        className={`absolute inset-y-0 left-0 rounded-full ${value > threshold ? 'bg-status-warning' : 'bg-status-success'}`}
        style={{ width: share(value) }}
      />
      <span
        className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-text-primary"
        style={{ left: share(threshold) }}
      />
    </span>
  );
}

function Periods({
  periods,
  labeled,
}: {
  periods: { label: string; status: ForecastStatus }[];
  labeled: boolean;
}) {
  return (
    <span
      className={`flex w-full items-center ${labeled ? 'justify-between' : 'justify-center gap-1.5'}`}
    >
      {periods.map((period) => (
        <span key={period.label} className="flex flex-col items-center gap-1">
          <span
            className={`block rounded-full ${labeled ? 'size-2.5' : 'size-2'} ${statusDot[period.status]}`}
          />
          {labeled && (
            <span className="text-ui-2xs leading-none text-text-secondary">{period.label}</span>
          )}
        </span>
      ))}
    </span>
  );
}

function Change({ percent }: { percent: number }) {
  const down = percent < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-ui-xs font-medium tabular-nums ${down ? 'text-status-warning' : 'text-status-success'}`}
    >
      <FontAwesomeIcon icon={down ? faArrowDown : faArrowUp} />
      {Math.round(Math.abs(percent))}%
    </span>
  );
}

export function ActionVisual({ visual, size = 'inline', decorative = false }: ActionVisualProps) {
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': visual.description };

  return (
    <span
      {...a11y}
      title={visual.description}
      className={`flex shrink-0 items-center justify-end ${box[size]}`}
    >
      {visual.type === 'trend' && <Trend values={visual.values} threshold={visual.threshold} />}
      {visual.type === 'meter' && <Meter value={visual.value} threshold={visual.threshold} />}
      {visual.type === 'periods' && (
        <Periods periods={visual.periods} labeled={size === 'detail'} />
      )}
      {visual.type === 'change' && <Change percent={visual.percent} />}
    </span>
  );
}
