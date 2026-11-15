import type { BiomassTrend, FieldDashboard } from '@/entities/field';
import { Metric } from './Metric';

type VegetationSectionProps = {
  dashboard: FieldDashboard;
  biomass: BiomassTrend | undefined;
};

const signedPercent = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

export function VegetationSection({ dashboard, biomass }: VegetationSectionProps) {
  const evaluation = dashboard.biomass;

  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="14-day average" value={evaluation.ndvi14DayAvg.toFixed(2)} />
        <Metric label="Change" value={`${signedPercent.format(evaluation.deltaPercent)}%`} />
        {biomass && (
          <Metric
            label="Rootzone"
            value={biomass.rootzoneMoisture.toFixed(2)}
            hint={biomass.isDroughtPresent ? 'drought likely' : undefined}
            tone={biomass.isDroughtPresent ? 'warning' : 'default'}
          />
        )}
      </dl>
      <p className="text-ui-xs text-text-secondary">{evaluation.recommendation}</p>
    </div>
  );
}
