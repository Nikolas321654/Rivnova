import type { DecisionCardModel } from './decisions';
import { chartColors } from './chartColors';
import type { HistoryPoint, MoistureRow } from './history';

export type SeriesKey =
  'ndvi' | 'rootzoneMoisture' | 'surfaceMoisture' | 'precipitationMm' | 'forecastRootzoneMoisture';

export type SeriesMeta = {
  label: string;
  color: string;
  digits: number;
  unit?: string;
  kind: 'line' | 'bar' | 'forecast';
};

export const seriesMeta: Record<SeriesKey, SeriesMeta> = {
  ndvi: { label: 'NDVI', color: chartColors.ndvi, digits: 3, kind: 'line' },
  rootzoneMoisture: {
    label: 'Rootzone moisture',
    color: chartColors.rootzone,
    digits: 2,
    kind: 'line',
  },
  surfaceMoisture: {
    label: 'Surface moisture',
    color: chartColors.surface,
    digits: 2,
    kind: 'line',
  },
  precipitationMm: {
    label: 'Rain',
    color: chartColors.precipitation,
    digits: 1,
    unit: 'mm',
    kind: 'bar',
  },
  forecastRootzoneMoisture: {
    label: 'Rootzone forecast',
    color: chartColors.forecast,
    digits: 2,
    kind: 'forecast',
  },
};

export const seriesOrder: SeriesKey[] = [
  'ndvi',
  'rootzoneMoisture',
  'surfaceMoisture',
  'precipitationMm',
  'forecastRootzoneMoisture',
];

export const decisionSeries: Record<DecisionCardModel['id'], SeriesKey[]> = {
  water: ['rootzoneMoisture', 'forecastRootzoneMoisture'],
  workability: ['precipitationMm', 'surfaceMoisture'],
  vegetation: ['ndvi'],
};

export type DayValues = Partial<Record<SeriesKey, number | null>>;

export function buildDayLookup(
  points: HistoryPoint[],
  rows: MoistureRow[],
): Map<string, DayValues> {
  const lookup = new Map<string, DayValues>();
  for (const point of points) {
    lookup.set(point.date, {
      ndvi: point.ndvi,
      rootzoneMoisture: point.rootzoneMoisture,
      surfaceMoisture: point.surfaceMoisture,
      precipitationMm: point.precipitationMm,
    });
  }
  for (const row of rows) {
    if (row.forecastRootzoneMoisture === null) continue;
    const isAnchor = row.rootzoneMoisture !== null;
    if (isAnchor) continue;
    lookup.set(row.date, {
      ...lookup.get(row.date),
      forecastRootzoneMoisture: row.forecastRootzoneMoisture,
    });
  }
  return lookup;
}

export function seriesEmphasis(key: SeriesKey, highlight: SeriesKey[] | null): number {
  return highlight === null || highlight.includes(key) ? 1 : 0.2;
}
