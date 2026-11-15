import {
  soilMachineryHint,
  sprayingCheckStep,
  type AlertSeverity,
  type EarlyStressAlert,
  type FieldDashboard,
  type WorkabilityStatus,
} from '@/entities/field';
import { WATER_DEFICIT_ALERT_THRESHOLD } from '@/shared/config/thresholds';

export type DecisionTone = 'success' | 'warning' | 'danger' | 'neutral';

export type DecisionCardModel = {
  id: 'water' | 'workability' | 'vegetation';
  title: string;
  status: string;
  tone: DecisionTone;
  value: string;
  valueTone?: DecisionTone;
  valueCaption: string;
  verdict: string;
  nextStep: string;
  explanation: string;
};

const severityTone: Record<AlertSeverity, DecisionTone> = {
  Critical: 'danger',
  Warning: 'warning',
  Info: 'warning',
};

const workabilityTone: Record<WorkabilityStatus, DecisionTone> = {
  Optimal: 'success',
  Marginal: 'warning',
  Blocked: 'danger',
  Unknown: 'neutral',
};

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

function waterCard(
  dashboard: FieldDashboard,
  stress: EarlyStressAlert | undefined,
): DecisionCardModel {
  const evaluation = dashboard.stressAndIrrigation;
  const threshold = stress?.threshold ?? WATER_DEFICIT_ALERT_THRESHOLD;
  const wdi = evaluation.waterDeficitIndex;
  const moisture = stress
    ? `Rootzone moisture ${stress.rootzoneMoisture.toFixed(2)} against a crop target of ${stress.cropTargetMoisture.toFixed(2)}.`
    : `Rootzone moisture ${dashboard.currentMetrics.rootzoneSoilMoisture.toFixed(2)}.`;

  return {
    id: 'water',
    title: 'Irrigation and water stress',
    status: evaluation.isHiddenStressDetected
      ? 'Hidden stress'
      : evaluation.irrigationRecommended
        ? 'Irrigation advised'
        : 'No water stress',
    tone: evaluation.irrigationRecommended ? severityTone[evaluation.severity] : 'success',
    value: wdi.toFixed(2),
    valueCaption: `WDI, alert above ${threshold.toFixed(2)}`,
    verdict: evaluation.irrigationRecommended
      ? `Irrigate ${oneDecimal.format(evaluation.recommendedIrrigationMm)} mm within ${evaluation.recommendedWindowHours}h`
      : 'No irrigation needed now',
    nextStep: evaluation.irrigationRecommended
      ? `Schedule ${oneDecimal.format(evaluation.recommendedIrrigationMm)} mm of irrigation within ${evaluation.recommendedWindowHours}h.`
      : 'Check the water balance again tomorrow.',
    explanation: evaluation.isHiddenStressDetected
      ? `Water deficit is high while NDVI still looks stable. ${moisture}`
      : moisture,
  };
}

function workabilityCard(dashboard: FieldDashboard): DecisionCardModel {
  const workability = dashboard.workability;
  const unconfirmed = workability.status === 'Unknown';
  const soil = soilMachineryHint(workability.surfaceMoisture);
  const spraying = workability.sprayingSafe ?? null;

  const verdict = unconfirmed
    ? soil.verdict
    : workability.status === 'Blocked'
      ? 'Keep machinery off the field'
      : workability.status === 'Marginal'
        ? 'Light operations only'
        : 'Field operations are possible';

  const machineryStep = unconfirmed
    ? `Recent rain is unknown. Check the topsoil on site before heavy machinery.`
    : workability.status === 'Blocked'
      ? 'Wait for the topsoil to dry before field work.'
      : workability.status === 'Marginal'
        ? 'Use light machinery and avoid heavy loads.'
        : null;

  const nextStep =
    spraying === false
      ? 'Hold spraying until the rain passes.'
      : spraying === null
        ? sprayingCheckStep(workability)
        : (machineryStep ?? 'Good window for field work and spraying today.');

  const rain12h =
    typeof workability.rainLast12hMm === 'number'
      ? `Rain in the last 12h: ${oneDecimal.format(workability.rainLast12hMm)} mm${workability.recentRainSource === 'OPEN_METEO_FORECAST' ? ' (Open-Meteo estimate)' : ''}.`
      : 'Recent rain is not available for this field, so the machinery verdict uses surface moisture only.';

  return {
    id: 'workability',
    title: 'Workability and spraying',
    status:
      spraying === null
        ? 'Check rain first'
        : spraying
          ? 'Spraying not blocked'
          : 'Spraying held back',
    tone: spraying === null ? 'neutral' : spraying ? 'success' : 'warning',
    value: unconfirmed ? soil.label : workability.status,
    valueTone: unconfirmed ? 'neutral' : (workabilityTone[workability.status] ?? 'neutral'),
    valueCaption: unconfirmed ? 'Machinery, from soil moisture' : 'Machinery',
    verdict,
    nextStep,
    explanation: `${rain12h} Surface moisture ${workability.surfaceMoisture.toFixed(2)}. This describes field operations, not crop health.`,
  };
}

function vegetationCard(
  dashboard: FieldDashboard,
  droughtPresent: boolean | undefined,
): DecisionCardModel {
  const biomass = dashboard.biomass;
  return {
    id: 'vegetation',
    title: 'Vegetation and biomass',
    status: biomass.isAnomalyDetected ? 'Decline detected' : 'No anomaly',
    tone: biomass.isAnomalyDetected ? 'warning' : 'success',
    value: biomass.currentNdvi.toFixed(2),
    valueCaption: `NDVI, ${signed.format(biomass.deltaNdvi)} vs 14-day avg`,
    verdict: biomass.isAnomalyDetected ? 'Scout the field' : 'No scouting needed now',
    nextStep: biomass.isAnomalyDetected
      ? 'Walk the field to find the cause of the NDVI drop.'
      : 'No action needed; check again in a few days.',
    explanation: biomass.isAnomalyDetected
      ? `NDVI fell ${oneDecimal.format(Math.abs(biomass.deltaPercent))}% while soil moisture stayed healthy. Check the cause on site.`
      : droughtPresent
        ? 'No unusual decline, but rootzone moisture is low, so watch for drought effects.'
        : 'NDVI is close to its 14-day average.',
  };
}

export function buildDecisionCards(
  dashboard: FieldDashboard,
  stress: EarlyStressAlert | undefined,
  droughtPresent: boolean | undefined,
): DecisionCardModel[] {
  return [
    waterCard(dashboard, stress),
    workabilityCard(dashboard),
    vegetationCard(dashboard, droughtPresent),
  ];
}

export function buildTodaysPlan(dashboard: FieldDashboard): string {
  const { stressAndIrrigation: water, workability, biomass } = dashboard;
  const steps: string[] = [];
  if (water.irrigationRecommended) {
    steps.push(
      `irrigate ${oneDecimal.format(water.recommendedIrrigationMm)} mm within ${water.recommendedWindowHours}h`,
    );
  }
  if (workability.status === 'Unknown') {
    steps.push(soilMachineryHint(workability.surfaceMoisture).planStep);
  } else if (workability.status === 'Blocked') {
    steps.push('keep machinery off');
  } else if (workability.status === 'Marginal') {
    steps.push('light machinery only');
  }
  if (workability.sprayingSafe === false) steps.push('hold spraying');
  else if (workability.sprayingSafe !== true) steps.push('check recent rain before spraying');
  if (biomass.isAnomalyDetected) steps.push('scout for the NDVI drop');

  if (steps.length === 0) return 'No urgent work today. Field work and spraying can go ahead.';
  const text = steps.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
