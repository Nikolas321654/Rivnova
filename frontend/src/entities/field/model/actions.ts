import { fieldShortName, withoutFieldPrefix } from '../lib/fieldName';
import { soilMachineryHint } from './guidance';
import type { AlertSeverity, FieldDashboard } from './types';
import { withoutLongDashes } from '@/shared/lib/text';

export type FieldActionKind = 'irrigate' | 'forecast' | 'spray' | 'machinery' | 'scout';

export type FieldAction = {
  id: string;
  fieldId: string;
  kind: FieldActionKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  recommendation: string;
};

const severityRank: Record<AlertSeverity, number> = { Critical: 0, Warning: 1, Info: 2 };
const kindRank: Record<FieldActionKind, number> = {
  irrigate: 0,
  forecast: 1,
  spray: 2,
  machinery: 3,
  scout: 4,
};
const sprayForecastLimitMm = 5;

const mm = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function fieldMessage(text: string, fieldName: string): string {
  return withoutLongDashes(withoutFieldPrefix(text, fieldName));
}

export function buildFieldActions(dashboard: FieldDashboard): FieldAction[] {
  const { fieldId, fieldName, stressAndIrrigation, workability, biomass } = dashboard;
  const name = fieldShortName(fieldName);
  const actions: FieldAction[] = [];

  if (stressAndIrrigation.irrigationRecommended) {
    actions.push({
      id: `${fieldId}:irrigate`,
      fieldId,
      kind: 'irrigate',
      severity: stressAndIrrigation.severity,
      title: `Irrigate ${name}`,
      detail: `${mm.format(stressAndIrrigation.recommendedIrrigationMm)} mm within ${stressAndIrrigation.recommendedWindowHours}h`,
      recommendation: fieldMessage(stressAndIrrigation.recommendation, fieldName),
    });
  }

  if (workability.sprayingSafe === false) {
    actions.push({
      id: `${fieldId}:spray`,
      fieldId,
      kind: 'spray',
      severity: 'Warning',
      title: `Don't spray ${name}`,
      detail:
        workability.rainForecast24hMm !== null &&
        workability.rainForecast24hMm !== undefined &&
        workability.rainForecast24hMm >= sprayForecastLimitMm
          ? `${mm.format(workability.rainForecast24hMm)} mm rain forecast`
          : `${workability.rainLast12hMm === null || workability.rainLast12hMm === undefined ? 'n/a' : mm.format(workability.rainLast12hMm)} mm rain in last 12h`,
      recommendation: fieldMessage(workability.recommendation, fieldName),
    });
  }

  switch (workability.status) {
    case 'Blocked':
    case 'Marginal':
      actions.push({
        id: `${fieldId}:machinery`,
        fieldId,
        kind: 'machinery',
        severity: workability.status === 'Blocked' ? 'Warning' : 'Info',
        title:
          workability.status === 'Blocked'
            ? `Keep machinery off ${name}`
            : `Light machinery only on ${name}`,
        detail: `Surface moisture ${workability.surfaceMoisture.toFixed(2)}`,
        recommendation: fieldMessage(workability.recommendation, fieldName),
      });
      break;
    case 'Unknown': {
      const soil = soilMachineryHint(workability.surfaceMoisture);
      const forecast =
        typeof workability.rainForecast24hMm === 'number'
          ? ` Next 24h: ${mm.format(workability.rainForecast24hMm)} mm rain forecast.`
          : '';
      actions.push({
        id: `${fieldId}:machinery`,
        fieldId,
        kind: 'machinery',
        severity: 'Info',
        title: `Check ${name} before heavy machinery`,
        detail: `${soil.label}, recent rain unknown`,
        recommendation: `Machinery safety unconfirmed. Surface moisture ${workability.surfaceMoisture.toFixed(2)} (${soil.label.toLowerCase()}), but recent rain is unknown. Check the topsoil on site before heavy machinery.${forecast}`,
      });
      break;
    }
    case 'Optimal':
      break;
  }

  if (biomass.isAnomalyDetected) {
    actions.push({
      id: `${fieldId}:scout`,
      fieldId,
      kind: 'scout',
      severity: 'Warning',
      title: `Scout ${name}`,
      detail: `NDVI down ${Math.round(Math.abs(biomass.deltaPercent))}%, soil moisture OK`,
      recommendation: fieldMessage(biomass.recommendation, fieldName),
    });
  }

  return actions;
}

export function sortActions(actions: FieldAction[]): FieldAction[] {
  return [...actions].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] || kindRank[a.kind] - kindRank[b.kind],
  );
}
