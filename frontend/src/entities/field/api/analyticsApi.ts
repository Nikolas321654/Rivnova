import { apiRequest } from '@/shared/api';
import type {
  BiomassTrend,
  EarlyStressAlert,
  FieldDashboard,
  FieldHistory,
  SoilForecast,
  WorkabilityWindow,
  RotationAdvice,
  RotationPriority,
  YieldPrediction,
} from '../model/types';

function fieldPath(id: string): string {
  return `/fields/${encodeURIComponent(id)}`;
}

export function getFieldDashboard(
  id: string,
  days?: number,
  signal?: AbortSignal,
): Promise<FieldDashboard> {
  const query = days === undefined ? '' : `?days=${encodeURIComponent(days)}`;
  return apiRequest(`${fieldPath(id)}/dashboard${query}`, { signal });
}

export function getWorkabilityWindow(id: string, signal?: AbortSignal): Promise<WorkabilityWindow> {
  return apiRequest(`${fieldPath(id)}/workability`, { signal });
}

export function getEarlyStressAlert(id: string, signal?: AbortSignal): Promise<EarlyStressAlert> {
  return apiRequest(`${fieldPath(id)}/stress`, { signal });
}

export function getBiomassTrend(id: string, signal?: AbortSignal): Promise<BiomassTrend> {
  return apiRequest(`${fieldPath(id)}/biomass`, { signal });
}

export function getSoilForecast(id: string, signal?: AbortSignal): Promise<SoilForecast> {
  return apiRequest(`${fieldPath(id)}/predictions/soil-forecast`, { signal });
}

export function getYieldPrediction(id: string, signal?: AbortSignal): Promise<YieldPrediction> {
  return apiRequest(`${fieldPath(id)}/predictions/yield`, { signal });
}

export function getRotationAdvice(
  id: string,
  priority: RotationPriority,
  signal?: AbortSignal,
): Promise<RotationAdvice> {
  return apiRequest(`${fieldPath(id)}/rotation-advisor?priority=${encodeURIComponent(priority)}`, {
    signal,
  });
}

export function getFieldHistory(
  id: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<FieldHistory> {
  return apiRequest(`${fieldPath(id)}/history?from=${from}&to=${to}`, { signal });
}
