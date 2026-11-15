import type { NasaDailyMetric, SoilForecastDay } from '@/entities/field';

export const historyDayOptions = [14, 30, 'season'] as const;

export type HistoryDays = (typeof historyDayOptions)[number];

export type HistoryPoint = {
  date: string;
  ndvi: number | null;
  rootzoneMoisture: number | null;
  surfaceMoisture: number | null;
  esi: number | null;
  precipitationMm: number | null;
};

export type HistoryMetric = Exclude<keyof HistoryPoint, 'date'>;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isObservationDate(value: unknown): value is string {
  return typeof value === 'string' && isoDate.test(value) && Number.isFinite(Date.parse(value));
}

export function parseHistoryDays(value: string | null): HistoryDays | null {
  return value === '30' ? 30 : value === '14' ? 14 : value === 'season' ? 'season' : null;
}

export function toHistoryPoints(series: NasaDailyMetric[]): HistoryPoint[] {
  const byDate = new Map<string, HistoryPoint>();
  for (const metric of series) {
    if (!isObservationDate(metric.date)) continue;
    byDate.set(metric.date, {
      date: metric.date,
      ndvi: finiteOrNull(metric.ndvi),
      rootzoneMoisture: finiteOrNull(metric.rootzoneMoisture),
      surfaceMoisture: finiteOrNull(metric.surfaceMoisture),
      esi: finiteOrNull(metric.esi),
      precipitationMm: finiteOrNull(metric.precipitationMm),
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function hasValues(points: HistoryPoint[], metrics: HistoryMetric[]): boolean {
  return points.some((point) => metrics.some((metric) => point[metric] !== null));
}

export function ndviDomain(points: HistoryPoint[], reference?: number): [number, number] {
  const values = points
    .map((point) => point.ndvi)
    .filter((value): value is number => value !== null);
  if (reference !== undefined && Number.isFinite(reference)) values.push(reference);
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.3, 0.05);
  const lower = Math.max(0, Math.floor((min - padding) * 20) / 20);
  const upper = Math.min(1, Math.ceil((max + padding) * 20) / 20);
  return [lower, upper];
}

export type MoistureRow = {
  date: string;
  rootzoneMoisture: number | null;
  surfaceMoisture: number | null;
  precipitationMm: number | null;
  forecastRootzoneMoisture: number | null;
  forecastWaterDeficitIndex: number | null;
};

export function lastObservationDate(points: HistoryPoint[]): string | null {
  return points.at(-1)?.date ?? null;
}

export function mergeMoistureForecast(
  points: HistoryPoint[],
  forecast: SoilForecastDay[] | undefined,
): MoistureRow[] {
  const rows: MoistureRow[] = points.map((point) => ({
    date: point.date,
    rootzoneMoisture: point.rootzoneMoisture,
    surfaceMoisture: point.surfaceMoisture,
    precipitationMm: point.precipitationMm,
    forecastRootzoneMoisture: null,
    forecastWaterDeficitIndex: null,
  }));
  const lastDate = lastObservationDate(points);
  const future = (forecast ?? [])
    .filter((day) => isoDate.test(day.date) && (lastDate === null || day.date > lastDate))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (future.length === 0) return rows;

  const anchor = rows.at(-1);
  if (anchor && anchor.rootzoneMoisture !== null) {
    anchor.forecastRootzoneMoisture = anchor.rootzoneMoisture;
  }
  for (const day of future) {
    rows.push({
      date: day.date,
      rootzoneMoisture: null,
      surfaceMoisture: null,
      precipitationMm: null,
      forecastRootzoneMoisture: finiteOrNull(day.predictedRootzoneMoisture),
      forecastWaterDeficitIndex: finiteOrNull(day.predictedWaterDeficitIndex),
    });
  }
  return rows;
}

export function metricChange(points: HistoryPoint[], metric: HistoryMetric): number | null {
  const values = points
    .map((point) => point[metric])
    .filter((value): value is number => value !== null);
  return values.length >= 2 ? values[values.length - 1] - values[0] : null;
}

const nasaLagBufferDays = 21;
const recentWindowDays = 30 + nasaLagBufferDays;

export function historyQueryPeriod(period: HistoryDays): string {
  return period === 'season' ? 'season' : 'recent';
}

export function historyRangeFor(
  plantedAt: string | undefined,
  period: HistoryDays,
  today = new Date().toISOString().slice(0, 10),
) {
  const daysBefore = (count: number) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - count);
    return date.toISOString().slice(0, 10);
  };
  const minimum = daysBefore(365);
  const start = period === 'season' ? (plantedAt ?? '') : daysBefore(recentWindowDays);
  return {
    from: start && start < minimum ? minimum : start,
    to: today,
    truncated: Boolean(start && start < minimum),
    future: start > today,
  };
}

export function withHistoryGaps(points: HistoryPoint[]): HistoryPoint[] {
  if (points.length < 2) return points;
  const byDate = new Map(points.map((point) => [point.date, point]));
  const result: HistoryPoint[] = [];
  const cursor = new Date(`${points[0].date}T00:00:00Z`);
  const end = points.at(-1)!.date;
  while (cursor.toISOString().slice(0, 10) <= end) {
    const date = cursor.toISOString().slice(0, 10);
    result.push(
      byDate.get(date) ?? {
        date,
        ndvi: null,
        rootzoneMoisture: null,
        surfaceMoisture: null,
        esi: null,
        precipitationMm: null,
      },
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export type SeasonHistoryState = {
  hasPlantingDate: boolean;
  seasonStarted: boolean;
  status: 'pending' | 'error' | 'success';
  observationCount: number;
};

export function resolveHistoryPeriod(
  requested: HistoryDays | null,
  season: SeasonHistoryState,
): HistoryDays {
  if (requested !== null) return requested;
  if (!season.hasPlantingDate || !season.seasonStarted) return 14;
  if (season.status === 'error') return 14;
  if (season.status === 'success' && season.observationCount === 0) return 14;
  return 'season';
}
