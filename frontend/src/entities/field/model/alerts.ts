import { fieldShortName } from '../lib/fieldName';
import { buildFieldActions, fieldMessage, type FieldAction, type FieldActionKind } from './actions';
import type { ActiveAlert, FieldDashboard } from './types';
import { withoutLongDashes } from '@/shared/lib/text';

export type AlertAction = FieldAction & {
  alertType: string;
  fieldName: string;
  predicted: boolean;
  dataSource: string | null;
  userFeedbackAccurate: boolean | null;
};

export type AlertProvenance = { sample: boolean; label: string };

export function alertProvenance(
  action: Pick<AlertAction, 'dataSource' | 'predicted'>,
): AlertProvenance | null {
  if (action.dataSource === 'MOCK_FIXTURE') {
    return {
      sample: true,
      label: action.predicted ? 'Model forecast from sample data' : 'Sample data',
    };
  }
  if (action.dataSource === 'NASA_POWER_LIVE') {
    return {
      sample: false,
      label: action.predicted
        ? 'Model forecast from live NASA POWER inputs'
        : 'Derived from live NASA POWER data',
    };
  }
  return null;
}

export type AlertGroup = {
  fieldId: string;
  primary: AlertAction;
  others: AlertAction[];
};

type ActionSummary = { kind: FieldActionKind; title: string; detail: string };

export function isPredictedAlert(alert: Pick<ActiveAlert, 'alertType'>): boolean {
  return alert.alertType === 'Predictive72hStress';
}

function summarize(alert: ActiveAlert, dashboard: FieldDashboard | undefined): ActionSummary {
  const dashboardActions = dashboard ? buildFieldActions(dashboard) : [];
  const find = (kind: FieldActionKind) => dashboardActions.find((action) => action.kind === kind);

  switch (alert.alertType) {
    case 'SmartIrrigation': {
      const irrigate = find('irrigate');
      return irrigate
        ? { kind: 'irrigate', title: `Irrigate ${irrigate.detail}`, detail: irrigate.detail }
        : { kind: 'irrigate', title: 'Water stress', detail: '' };
    }
    case 'Predictive72hStress':
      return { kind: 'forecast', title: 'Stress expected in 72h', detail: '' };
    case 'SprayingBlocked':
      return { kind: 'spray', title: "Don't spray", detail: find('spray')?.detail ?? '' };
    case 'WorkabilityBlocked':
      return {
        kind: 'machinery',
        title: 'Keep machinery off',
        detail: find('machinery')?.detail ?? '',
      };
    case 'WorkabilityMarginal':
      return {
        kind: 'machinery',
        title: 'Light machinery only',
        detail: find('machinery')?.detail ?? '',
      };
    case 'BiomassAnomaly':
      return { kind: 'scout', title: 'Scout for NDVI drop', detail: find('scout')?.detail ?? '' };
    default:
      return { kind: 'scout', title: withoutLongDashes(alert.title), detail: '' };
  }
}

export function alertToAction(alert: ActiveAlert, dashboard?: FieldDashboard): AlertAction {
  const { kind, title, detail } = summarize(alert, dashboard);
  return {
    id: alert.id,
    fieldId: alert.fieldId,
    kind,
    severity: alert.severity,
    title,
    detail,
    recommendation: fieldMessage(alert.message, alert.fieldName),
    alertType: alert.alertType,
    fieldName: fieldShortName(alert.fieldName),
    predicted: isPredictedAlert(alert),
    dataSource: alert.dataSource ?? null,
    userFeedbackAccurate: alert.userFeedbackAccurate ?? null,
  };
}

export function alertGroups(
  alerts: ActiveAlert[],
  fieldIds: Iterable<string>,
  dashboards: FieldDashboard[] = [],
): AlertGroup[] {
  const visible = new Set(fieldIds);
  const dashboardById = new Map(dashboards.map((dashboard) => [dashboard.fieldId, dashboard]));
  const seen = new Set<string>();
  const groups = new Map<string, AlertGroup>();

  for (const alert of alerts) {
    if (!visible.has(alert.fieldId) || seen.has(alert.id)) continue;
    seen.add(alert.id);
    const action = alertToAction(alert, dashboardById.get(alert.fieldId));
    const group = groups.get(alert.fieldId);
    if (group) group.others.push(action);
    else groups.set(alert.fieldId, { fieldId: alert.fieldId, primary: action, others: [] });
  }

  return [...groups.values()];
}
