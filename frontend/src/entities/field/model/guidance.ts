import type { DashboardWorkability, ForecastStatus } from './types';

export type SoilHint = { label: string; verdict: string; planStep: string };

export function soilMachineryHint(surfaceMoisture: number): SoilHint {
  if (surfaceMoisture < 0.35) {
    return {
      label: 'Dry soil',
      verdict: 'Soil looks firm enough for machinery',
      planStep: 'field work looks fine on dry soil',
    };
  }
  if (surfaceMoisture < 0.45) {
    return {
      label: 'Damp soil',
      verdict: 'Light machinery only',
      planStep: 'light machinery only',
    };
  }
  return {
    label: 'Wet soil',
    verdict: 'Keep heavy machinery off',
    planStep: 'keep heavy machinery off',
  };
}

export function sprayingCheckStep(workability: DashboardWorkability): string {
  const forecast = workability.rainForecast24hMm;
  if (typeof forecast === 'number' && forecast < 5) {
    return 'No heavy rain is forecast. Confirm the last 12h were dry before spraying.';
  }
  return 'Check the rain forecast and the last 12h before spraying.';
}

export function recentRainLabel(source: string | null | undefined): string | undefined {
  if (source === 'OPEN_METEO_FORECAST') return 'Open-Meteo estimate';
  if (source === 'MOCK_FIXTURE') return 'Sample data';
  return undefined;
}

export const unconfirmedStatusLabel = 'Unconfirmed';

export function workabilityLabel(status: ForecastStatus): string {
  return status === 'Unknown' ? unconfirmedStatusLabel : status;
}
