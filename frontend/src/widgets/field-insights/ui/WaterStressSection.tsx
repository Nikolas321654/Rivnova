import type { EarlyStressAlert, FieldDashboard } from '@/entities/field';
import { WATER_DEFICIT_ALERT_THRESHOLD } from '@/shared/config/thresholds';
import { Metric } from './Metric';

type WaterStressSectionProps = {
  dashboard: FieldDashboard;
  stress: EarlyStressAlert | undefined;
};

export function WaterStressSection({ dashboard, stress }: WaterStressSectionProps) {
  const evaluation = dashboard.stressAndIrrigation;

  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric
          label="Alert threshold"
          value={(stress?.threshold ?? WATER_DEFICIT_ALERT_THRESHOLD).toFixed(2)}
        />
        <Metric
          label="Rootzone moisture"
          value={(
            stress?.rootzoneMoisture ?? dashboard.currentMetrics.rootzoneSoilMoisture
          ).toFixed(2)}
          hint={stress ? `target ${stress.cropTargetMoisture.toFixed(2)}` : undefined}
        />
        <Metric
          label="Evaporative stress"
          value={dashboard.currentMetrics.evaporativeStressIndex.toFixed(2)}
        />
        <Metric
          label="Irrigation window"
          value={
            evaluation.irrigationRecommended ? `${evaluation.recommendedWindowHours}h` : 'None'
          }
        />
      </dl>
      <p className="text-ui-xs text-text-secondary">{evaluation.recommendation}</p>
    </div>
  );
}
