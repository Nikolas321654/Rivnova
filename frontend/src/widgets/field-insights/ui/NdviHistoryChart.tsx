import { useId } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatObservationDate } from '@/entities/field';
import { chartColors, chartSyncId } from '../model/chartColors';
import { hasValues, ndviDomain, type HistoryPoint } from '../model/history';
import { seriesEmphasis, type DayValues, type SeriesKey } from '../model/series';
import { DayTooltip } from './DayTooltip';
import { InfoTip } from '@/shared/ui';

type NdviHistoryChartProps = {
  points: HistoryPoint[];
  average: number | undefined;
  anomaly: boolean;
  hidden: Set<SeriesKey>;
  highlight: SeriesKey[] | null;
  lookup: Map<string, DayValues>;
};

const animation = {
  isAnimationActive: true,
  animationDuration: 450,
  animationEasing: 'ease-out',
} as const;

export function NdviHistoryChart({
  points,
  average,
  anomaly,
  hidden,
  highlight,
  lookup,
}: NdviHistoryChartProps) {
  const summaryId = useId();
  const available = hasValues(points, ['ndvi']);
  const domain = ndviDomain(points, average);
  const last = [...points].reverse().find((point) => point.ndvi !== null);
  const emphasis = seriesEmphasis('ndvi', highlight);

  return (
    <figure className="min-w-0" aria-describedby={summaryId}>
      <figcaption className="flex items-center">
        <span className="type-section-title">NDVI</span>
        <InfoTip
          label="NDVI"
          text={`Vegetation greenness from 0 (bare soil) to 1 (dense canopy). The axis is zoomed to ${domain[0].toFixed(2)} to ${domain[1].toFixed(2)}${average === undefined ? '.' : '; the dashed line is the 14-day average.'}`}
        />
      </figcaption>
      {available ? (
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              syncId={chartSyncId}
              syncMethod="value"
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatObservationDate(String(value))}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: chartColors.border }}
                minTickGap={28}
              />
              <YAxis
                domain={domain}
                tickCount={4}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickFormatter={(value) => Number(value).toFixed(2)}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                content={({ active, label }) => (
                  <DayTooltip active={active} label={label} lookup={lookup} hidden={hidden} />
                )}
                cursor={{ stroke: chartColors.axis, strokeDasharray: '3 3' }}
              />
              {average !== undefined && (
                <ReferenceLine y={average} stroke={chartColors.ndviAverage} strokeDasharray="4 4" />
              )}
              <Line
                type="linear"
                dataKey="ndvi"
                stroke={chartColors.ndvi}
                strokeWidth={emphasis === 1 && highlight ? 2.75 : 2}
                strokeOpacity={emphasis}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                hide={hidden.has('ndvi')}
                {...animation}
              />
              {anomaly && last && last.ndvi !== null && !hidden.has('ndvi') && (
                <ReferenceDot
                  x={last.date}
                  y={last.ndvi}
                  r={5}
                  fill={chartColors.surfaceBackground}
                  stroke={chartColors.anomaly}
                  strokeWidth={2}
                  label={{
                    value: 'Decline',
                    position: 'top',
                    fill: chartColors.anomaly,
                    fontSize: 11,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-2 rounded-control bg-surface-muted px-3 py-5 text-center text-ui-sm text-text-secondary">
          No NDVI observations for this period.
        </p>
      )}
      <p id={summaryId} className="sr-only">
        {available && last
          ? `NDVI over ${points.length} days, latest ${last.ndvi?.toFixed(2)} on ${formatObservationDate(last.date)}, 14-day average ${average?.toFixed(2) ?? 'unavailable'}.${anomaly ? ' An unusual decline was detected.' : ''}`
          : 'No NDVI observations available.'}
      </p>
    </figure>
  );
}
