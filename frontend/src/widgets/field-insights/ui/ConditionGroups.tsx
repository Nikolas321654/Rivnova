import type { BiomassTrend, EarlyStressAlert, FieldDashboard } from '@/entities/field';
import { metricChange, type HistoryMetric, type HistoryPoint } from '../model/history';
import type { SeriesKey } from '../model/series';
import { ConditionGroup as Group } from './ConditionGroup';
import { Metric } from './Metric';

type ConditionGroupsProps = {
  dashboard: FieldDashboard;
  stress: EarlyStressAlert | undefined;
  biomass: BiomassTrend | undefined;
  points: HistoryPoint[];
  highlight: SeriesKey[] | null;
  onHighlight: (keys: SeriesKey[] | null) => void;
};

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

function trend(points: HistoryPoint[], metric: HistoryMetric): string | undefined {
  const change = metricChange(points, metric);
  return change === null ? undefined : `${signed.format(change)} in ${points.length}d`;
}

export function ConditionGroups({
  dashboard,
  stress,
  biomass,
  points,
  highlight,
  onHighlight,
}: ConditionGroupsProps) {
  const metrics = dashboard.currentMetrics;
  const bind = (key: SeriesKey) => ({
    active: highlight?.length === 1 && highlight[0] === key,
    onHighlight: (active: boolean) => onHighlight(active ? [key] : null),
  });

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <Group title="Water">
        <Metric
          label="Rootzone moisture"
          value={metrics.rootzoneSoilMoisture.toFixed(2)}
          hint={[
            stress && `target ${stress.cropTargetMoisture.toFixed(2)}`,
            trend(points, 'rootzoneMoisture'),
          ]
            .filter(Boolean)
            .join(', ')}
          info="Soil wetness in the top metre, from 0 (dry) to 1 (saturated)."
          {...bind('rootzoneMoisture')}
        />
        <Metric
          label="Surface moisture"
          value={metrics.surfaceSoilMoisture.toFixed(2)}
          hint={trend(points, 'surfaceMoisture')}
          info="Soil wetness in the top 5 cm, from 0 (dry) to 1 (saturated)."
          {...bind('surfaceMoisture')}
        />
      </Group>
      <Group title="Vegetation">
        <Metric
          label="NDVI, 14-day avg"
          value={(biomass?.ndvi14DayAvg ?? dashboard.biomass.ndvi14DayAvg).toFixed(2)}
          hint={trend(points, 'ndvi')}
          info="Vegetation greenness, from 0 (bare soil) to 1 (dense canopy)."
          {...bind('ndvi')}
        />
        <Metric
          label="Evaporative stress"
          value={metrics.evaporativeStressIndex.toFixed(2)}
          info="Evaporative stress index from 0 to 1. Higher values lower the water deficit index."
        />
      </Group>
      <Group title="Weather">
        <Metric
          label="Rain, 24h"
          value={
            metrics.precipitationMm24h === null || metrics.precipitationMm24h === undefined
              ? 'n/a'
              : oneDecimal.format(metrics.precipitationMm24h)
          }
          unit="mm"
          hint={`${oneDecimal.format(metrics.accumulatedPrecipitationMm30d)} mm in 30d`}
          {...bind('precipitationMm')}
        />
        <Metric
          label="Solar radiation"
          value={oneDecimal.format(metrics.solarRadiation)}
          unit="MJ/m²"
        />
      </Group>
    </div>
  );
}
