import {
  workabilityLabel,
  type AlertAction,
  type FieldDashboard,
  type SoilForecast,
  type ForecastStatus,
  type WorkabilityWindow,
} from '@/entities/field';
import { WATER_DEFICIT_ALERT_THRESHOLD } from '@/shared/config/thresholds';

export type ActionVisualModel =
  | { type: 'trend'; values: number[]; threshold: number; description: string }
  | { type: 'meter'; value: number; threshold: number; description: string }
  | {
      type: 'periods';
      periods: { label: string; status: ForecastStatus }[];
      description: string;
    }
  | { type: 'change'; percent: number; description: string };

export type ActionFact = { label: string; value: string };

export type ActionView = {
  visual: ActionVisualModel | null;
  facts: ActionFact[];
};

export type ActionContext = {
  dashboard?: FieldDashboard;
  forecast?: SoilForecast;
  workability?: WorkabilityWindow;
};

const periodLabels = ['Today', '24h', '48h'];
const two = (value: number) => value.toFixed(2);
const mm = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function waterView(dashboard: FieldDashboard | undefined): ActionView {
  if (!dashboard) return { visual: null, facts: [] };
  const stress = dashboard.stressAndIrrigation;
  const facts: ActionFact[] = [{ label: 'WDI now', value: two(stress.waterDeficitIndex) }];
  if (stress.irrigationRecommended) {
    facts.push(
      { label: 'Dose', value: `${mm.format(stress.recommendedIrrigationMm)} mm` },
      { label: 'Act within', value: `${stress.recommendedWindowHours}h` },
    );
  }
  return {
    visual: {
      type: 'meter',
      value: stress.waterDeficitIndex,
      threshold: WATER_DEFICIT_ALERT_THRESHOLD,
      description: `Water deficit index ${two(stress.waterDeficitIndex)}, alert above ${WATER_DEFICIT_ALERT_THRESHOLD}`,
    },
    facts,
  };
}

function forecastView(context: ActionContext): ActionView {
  const { dashboard, forecast } = context;
  const facts: ActionFact[] = [];
  if (dashboard) {
    facts.push({ label: 'WDI now', value: two(dashboard.stressAndIrrigation.waterDeficitIndex) });
  }
  if (forecast) {
    facts.push({ label: 'WDI in 72h', value: two(forecast.forecastedDay3WaterDeficitIndex) });
  }
  facts.push({ label: 'Alert above', value: String(WATER_DEFICIT_ALERT_THRESHOLD) });

  const values = forecast
    ? [...forecast.forecastSeries]
        .sort((a, b) => a.dayOffset - b.dayOffset)
        .map((day) => day.predictedWaterDeficitIndex)
    : [];
  if (dashboard && values.length > 0)
    values.unshift(dashboard.stressAndIrrigation.waterDeficitIndex);

  return {
    visual:
      values.length >= 2
        ? {
            type: 'trend',
            values,
            threshold: WATER_DEFICIT_ALERT_THRESHOLD,
            description: `Forecast water deficit index over ${values.length - 1} days, alert above ${WATER_DEFICIT_ALERT_THRESHOLD}`,
          }
        : null,
    facts,
  };
}

function workabilityView(context: ActionContext): ActionView {
  const { dashboard, workability } = context;
  const facts: ActionFact[] = [];
  if (dashboard) {
    const window = dashboard.workability;
    facts.push(
      { label: 'Today', value: workabilityLabel(window.status) },
      {
        label: 'Rain 24h',
        value:
          window.rainForecast24hMm === null || window.rainForecast24hMm === undefined
            ? 'n/a'
            : `${mm.format(window.rainForecast24hMm)} mm`,
      },
      { label: 'Topsoil', value: two(window.surfaceMoisture) },
    );
  }
  const periods = (workability?.forecast48h ?? []).slice(0, 3).map((period, index) => ({
    label: periodLabels[index] ?? period.period,
    status: period.status,
  }));
  return {
    visual:
      periods.length > 0
        ? {
            type: 'periods',
            periods,
            description: `Workability ${periods.map((period) => `${period.label} ${workabilityLabel(period.status)}`).join(', ')}`,
          }
        : null,
    facts,
  };
}

function vegetationView(dashboard: FieldDashboard | undefined): ActionView {
  if (!dashboard) return { visual: null, facts: [] };
  const biomass = dashboard.biomass;
  return {
    visual: {
      type: 'change',
      percent: biomass.deltaPercent,
      description: `NDVI ${biomass.deltaPercent < 0 ? 'down' : 'up'} ${percent.format(Math.abs(biomass.deltaPercent))}% versus the 14-day average`,
    },
    facts: [
      { label: 'NDVI now', value: two(biomass.currentNdvi) },
      { label: '14-day avg', value: two(biomass.ndvi14DayAvg) },
      { label: 'Change', value: `${percent.format(biomass.deltaPercent)}%` },
    ],
  };
}

export function actionView(action: AlertAction, context: ActionContext): ActionView {
  switch (action.kind) {
    case 'irrigate':
      return waterView(context.dashboard);
    case 'forecast':
      return forecastView(context);
    case 'spray':
    case 'machinery':
      return workabilityView(context);
    case 'scout':
      return vegetationView(context.dashboard);
  }
}
