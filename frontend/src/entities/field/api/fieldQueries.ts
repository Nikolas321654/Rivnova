import { keepPreviousData, queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import {
  getBiomassTrend,
  getFieldHistory,
  getEarlyStressAlert,
  getFieldDashboard,
  getSoilForecast,
  getWorkabilityWindow,
  getRotationAdvice,
  getYieldPrediction,
} from './analyticsApi';
import { getActiveAlerts } from './alertApi';
import { getFieldById, getFields } from './fieldApi';
import type { RotationPriority } from '../model/types';
import { fieldQueryKeys } from './queryKeys';

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidFieldId(id: string | null | undefined): id is string {
  return typeof id === 'string' && guidPattern.test(id);
}

export function useFields() {
  return useQuery({
    queryKey: fieldQueryKeys.list(),
    queryFn: ({ signal }) => getFields(signal),
  });
}

export function useActiveAlerts() {
  return useQuery({
    queryKey: fieldQueryKeys.alerts(),
    queryFn: ({ signal }) => getActiveAlerts(signal),
  });
}

export function useField(id: string | null | undefined) {
  return useQuery({
    queryKey: fieldQueryKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getFieldById(id ?? '', signal),
    enabled: isValidFieldId(id),
  });
}

function fieldDashboardQuery(id: string | null | undefined, days?: number) {
  return queryOptions({
    queryKey: fieldQueryKeys.dashboard(id ?? '', days),
    queryFn: ({ signal }) => getFieldDashboard(id ?? '', days, signal),
    enabled: isValidFieldId(id),
  });
}

export function useFieldDashboard(
  id: string | null | undefined,
  days?: number,
  options: { keepPrevious?: boolean } = {},
) {
  return useQuery({
    ...fieldDashboardQuery(id, days),
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useFieldDashboards(ids: string[], days?: number) {
  return useQueries({ queries: ids.map((id) => fieldDashboardQuery(id, days)) });
}

function fieldWorkabilityQuery(id: string | null | undefined) {
  return queryOptions({
    queryKey: fieldQueryKeys.workability(id ?? ''),
    queryFn: ({ signal }) => getWorkabilityWindow(id ?? '', signal),
    enabled: isValidFieldId(id),
  });
}

export function useFieldWorkability(id: string | null | undefined) {
  return useQuery(fieldWorkabilityQuery(id));
}

export function useFieldWorkabilities(ids: string[]) {
  return useQueries({ queries: ids.map((id) => fieldWorkabilityQuery(id)) });
}

export function useFieldStress(id: string | null | undefined) {
  return useQuery({
    queryKey: fieldQueryKeys.stress(id ?? ''),
    queryFn: ({ signal }) => getEarlyStressAlert(id ?? '', signal),
    enabled: isValidFieldId(id),
  });
}

export function useFieldBiomass(id: string | null | undefined) {
  return useQuery({
    queryKey: fieldQueryKeys.biomass(id ?? ''),
    queryFn: ({ signal }) => getBiomassTrend(id ?? '', signal),
    enabled: isValidFieldId(id),
  });
}

function fieldSoilForecastQuery(id: string | null | undefined) {
  return queryOptions({
    queryKey: fieldQueryKeys.soilForecast(id ?? ''),
    queryFn: ({ signal }) => getSoilForecast(id ?? '', signal),
    enabled: isValidFieldId(id),
  });
}

export function useFieldSoilForecast(id: string | null | undefined) {
  return useQuery(fieldSoilForecastQuery(id));
}

export function useFieldSoilForecasts(ids: string[]) {
  return useQueries({ queries: ids.map((id) => fieldSoilForecastQuery(id)) });
}

export function useFieldYieldPrediction(id: string | null | undefined) {
  return useQuery({
    queryKey: fieldQueryKeys.yieldPrediction(id ?? ''),
    queryFn: ({ signal }) => getYieldPrediction(id ?? '', signal),
    enabled: isValidFieldId(id),
  });
}

export function useFieldRotationAdvice(
  id: string | null | undefined,
  priority: RotationPriority,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: fieldQueryKeys.rotationAdvice(id ?? '', priority),
    queryFn: ({ signal }) => getRotationAdvice(id ?? '', priority, signal),
    enabled: isValidFieldId(id) && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

export function useFieldHistory(id: string | undefined, from: string, to: string, period: string) {
  return useQuery({
    queryKey: fieldQueryKeys.history(id ?? '', from, to, period),
    queryFn: ({ signal }) => getFieldHistory(id ?? '', from, to, signal),
    enabled: isValidFieldId(id) && Boolean(from) && from <= to,
    staleTime: 60 * 60 * 1000,
  });
}
