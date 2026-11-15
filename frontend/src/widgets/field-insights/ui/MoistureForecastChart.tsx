import { useId } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatObservationDate } from '@/entities/field';
import { chartColors, chartSyncId } from '../model/chartColors';
import type { MoistureRow } from '../model/history';
import { seriesEmphasis, type DayValues, type SeriesKey } from '../model/series';
import { DayTooltip } from './DayTooltip';
import { InfoTip } from '@/shared/ui';

type MoistureForecastChartProps = {
  rows: MoistureRow[];
  lastObservation: string | null;
  cropTarget: number | undefined;
  hidden: Set<SeriesKey>;
  highlight: SeriesKey[] | null;
  lookup: Map<string, DayValues>;
};

const animation = {
  isAnimationActive: true,
  animationDuration: 450,
  animationEasing: 'ease-out',
} as const;

export function MoistureForecastChart({
  rows,
  lastObservation,
  cropTarget,
  hidden,
  highlight,
  lookup,
}: MoistureForecastChartProps) {
  const summaryId = useId();
  const observed = rows.filter(
    (row) => row.rootzoneMoisture !== null || row.precipitationMm !== null,
  );
  const forecastRows = lastObservation ? rows.filter((row) => row.date > lastObservation) : [];
  const available = observed.length > 0;
  const lastForecast = forecastRows.at(-1)?.date;
  const width = (key: SeriesKey, base: number) => (highlight?.includes(key) ? base + 0.75 : base);

  return (
    <figure className="min-w-0" aria-describedby={summaryId}>
      <figcaption className="flex items-center">
        <span className="type-section-title">Soil moisture and rain</span>
        <InfoTip
          label="soil moisture and rain"
          text="Moisture runs from 0 (dry) to 1 (saturated) on the left axis. Rain is in mm on the right axis. The dashed line after the last observation is the ONNX soil model forecast, not a weather forecast."
        />
      </figcaption>
      {available ? (
        <div className="mt-2 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              syncId={chartSyncId}
              syncMethod="value"
              margin={{ top: 8, right: 0, bottom: 0, left: -12 }}
            >
              <CartesianGrid stroke={chartColors.grid} vertical={false} yAxisId="moisture" />
              {lastObservation && lastForecast && (
                <ReferenceArea
                  x1={lastObservation}
                  x2={lastForecast}
                  yAxisId="moisture"
                  fill={chartColors.forecastArea}
                  fillOpacity={0.7}
                />
              )}
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatObservationDate(String(value))}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: chartColors.border }}
                minTickGap={28}
              />
              <YAxis
                yAxisId="moisture"
                domain={[0, 1]}
                tickCount={3}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickFormatter={(value) => Number(value).toFixed(1)}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <YAxis
                yAxisId="rain"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
                unit=" mm"
              />
              <Tooltip
                content={({ active, label }) => (
                  <DayTooltip active={active} label={label} lookup={lookup} hidden={hidden} />
                )}
                cursor={{ stroke: chartColors.axis, strokeDasharray: '3 3' }}
              />
              <Bar
                yAxisId="rain"
                dataKey="precipitationMm"
                fill={chartColors.precipitation}
                fillOpacity={seriesEmphasis('precipitationMm', highlight)}
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
                hide={hidden.has('precipitationMm')}
                {...animation}
              />
              {cropTarget !== undefined && (
                <ReferenceLine
                  yAxisId="moisture"
                  y={cropTarget}
                  stroke={chartColors.cropTarget}
                  strokeDasharray="2 4"
                  label={{
                    value: `target ${cropTarget.toFixed(2)}`,
                    position: 'insideBottomLeft',
                    fill: chartColors.cropTarget,
                    fontSize: 10,
                  }}
                />
              )}
              {lastObservation && lastForecast && (
                <ReferenceLine
                  yAxisId="moisture"
                  x={lastObservation}
                  stroke={chartColors.axis}
                  label={{
                    value: `Last observation ${formatObservationDate(lastObservation)}`,
                    position: 'insideTopLeft',
                    fill: chartColors.axis,
                    fontSize: 10,
                  }}
                />
              )}
              <Line
                yAxisId="moisture"
                type="linear"
                dataKey="rootzoneMoisture"
                stroke={chartColors.rootzone}
                strokeWidth={width('rootzoneMoisture', 2)}
                strokeOpacity={seriesEmphasis('rootzoneMoisture', highlight)}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                hide={hidden.has('rootzoneMoisture')}
                {...animation}
              />
              <Line
                yAxisId="moisture"
                type="linear"
                dataKey="surfaceMoisture"
                stroke={chartColors.surface}
                strokeWidth={width('surfaceMoisture', 1.5)}
                strokeOpacity={seriesEmphasis('surfaceMoisture', highlight) * 0.8}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls={false}
                hide={hidden.has('surfaceMoisture')}
                {...animation}
              />
              {forecastRows.length > 0 && (
                <Line
                  yAxisId="moisture"
                  type="linear"
                  dataKey="forecastRootzoneMoisture"
                  stroke={chartColors.forecast}
                  strokeWidth={width('forecastRootzoneMoisture', 2)}
                  strokeOpacity={seriesEmphasis('forecastRootzoneMoisture', highlight)}
                  strokeDasharray="6 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  hide={hidden.has('forecastRootzoneMoisture')}
                  {...animation}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-2 rounded-control bg-surface-muted px-3 py-5 text-center text-ui-sm text-text-secondary">
          No soil moisture or rain observations for this period.
        </p>
      )}
      <p id={summaryId} className="sr-only">
        {`${observed.length} days of observed soil moisture and rain.${forecastRows.length > 0 ? ` Followed by ${forecastRows.length} days of model forecast after ${lastObservation ? formatObservationDate(lastObservation) : 'the last observation'}.` : ''}`}
      </p>
    </figure>
  );
}
