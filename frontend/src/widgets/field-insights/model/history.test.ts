import { describe, expect, it } from 'vitest';
import { makeSeries, makeSoilForecast } from '@/entities/field/testing';
import {
  hasValues,
  historyQueryPeriod,
  historyRangeFor,
  withHistoryGaps,
  lastObservationDate,
  mergeMoistureForecast,
  metricChange,
  ndviDomain,
  parseHistoryDays,
  resolveHistoryPeriod,
  toHistoryPoints,
} from './history';

describe('parseHistoryDays', () => {
  it('accepts 30 and falls back to season for anything else', () => {
    expect(parseHistoryDays('30')).toBe(30);
    expect(parseHistoryDays('14')).toBe(14);
    expect(parseHistoryDays('season')).toBe('season');
    expect(parseHistoryDays(null)).toBeNull();
    expect(parseHistoryDays('90')).toBeNull();
  });
});

describe('toHistoryPoints', () => {
  it('keeps backend dates and sorts them chronologically', () => {
    const series = makeSeries(3, '2026-11-14').reverse();
    expect(toHistoryPoints(series).map((point) => point.date)).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);
  });

  it('drops observations with invalid dates instead of inventing them', () => {
    const [valid] = makeSeries(1);
    const points = toHistoryPoints([
      valid,
      { ...valid, date: 'not-a-date' },
      { ...valid, date: '' },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].date).toBe(valid.date);
  });

  it('turns non-finite values into gaps, never into zero', () => {
    const [valid] = makeSeries(1);
    const [point] = toHistoryPoints([{ ...valid, ndvi: Number.NaN, precipitationMm: Infinity }]);
    expect(point.ndvi).toBeNull();
    expect(point.precipitationMm).toBeNull();
    expect(point.rootzoneMoisture).toBe(valid.rootzoneMoisture);
  });

  it('reports whether any series has values', () => {
    const [valid] = makeSeries(1);
    const points = toHistoryPoints([{ ...valid, ndvi: Number.NaN }]);
    expect(hasValues(points, ['ndvi'])).toBe(false);
    expect(hasValues(points, ['ndvi', 'rootzoneMoisture'])).toBe(true);
    expect(hasValues([], ['ndvi'])).toBe(false);
  });
});

describe('ndviDomain', () => {
  it('zooms around the data and the reference while staying within 0 to 1', () => {
    const points = toHistoryPoints(makeSeries(14));
    const [lower, upper] = ndviDomain(points, 0.75);
    expect(lower).toBeGreaterThanOrEqual(0);
    expect(upper).toBeLessThanOrEqual(1);
    expect(lower).toBeLessThan(0.74);
    expect(upper).toBeGreaterThan(0.76);
    expect(upper - lower).toBeGreaterThanOrEqual(0.1);
  });

  it('falls back to the full range without data', () => {
    expect(ndviDomain([])).toEqual([0, 1]);
  });
});

describe('mergeMoistureForecast', () => {
  const points = toHistoryPoints(makeSeries(3, '2026-11-14'));

  it('appends forecast days after the last observation and anchors the dashed line on it', () => {
    const rows = mergeMoistureForecast(points, makeSoilForecast().forecastSeries);
    expect(rows).toHaveLength(10);
    expect(rows[2]).toMatchObject({
      date: '2026-11-14',
      forecastRootzoneMoisture: rows[2].rootzoneMoisture,
    });
    expect(rows[3]).toMatchObject({
      date: '2026-11-15',
      rootzoneMoisture: null,
      precipitationMm: null,
    });
    expect(rows[3].forecastRootzoneMoisture).toBeCloseTo(0.3);
  });

  it('ignores forecast days that overlap observations', () => {
    const rows = mergeMoistureForecast(points, makeSoilForecast({}, '2026-11-13').forecastSeries);
    expect(rows.map((row) => row.date)).not.toContain('2026-11-13T');
    expect(rows.filter((row) => row.date === '2026-11-14')).toHaveLength(1);
    expect(rows.at(-1)?.date).toBe('2026-11-19');
  });

  it('returns observations unchanged without a forecast', () => {
    expect(mergeMoistureForecast(points, undefined)).toHaveLength(3);
  });
});

describe('metricChange and lastObservationDate', () => {
  it('measure change between the first and last valid values', () => {
    const points = toHistoryPoints(makeSeries(3, '2026-11-14'));
    expect(metricChange(points, 'rootzoneMoisture')).toBeCloseTo(-0.01);
    expect(lastObservationDate(points)).toBe('2026-11-14');
    expect(metricChange(points.slice(0, 1), 'ndvi')).toBeNull();
  });
});

describe('buildDayLookup', () => {
  it('collects every observed value for a date and marks forecast days separately', async () => {
    const { buildDayLookup } = await import('./series');
    const points = toHistoryPoints(makeSeries(2, '2026-11-14'));
    const rows = mergeMoistureForecast(points, makeSoilForecast().forecastSeries);
    const lookup = buildDayLookup(points, rows);
    expect(lookup.get('2026-11-14')).toMatchObject({
      ndvi: points[1].ndvi,
      precipitationMm: points[1].precipitationMm,
    });
    expect(lookup.get('2026-11-14')?.forecastRootzoneMoisture).toBeUndefined();
    expect(lookup.get('2026-11-15')?.forecastRootzoneMoisture).toBeCloseTo(0.3);
    expect(lookup.get('2026-11-15')?.ndvi).toBeUndefined();
  });
});

describe('seriesEmphasis', () => {
  it('dims series that are not highlighted', async () => {
    const { seriesEmphasis } = await import('./series');
    expect(seriesEmphasis('ndvi', null)).toBe(1);
    expect(seriesEmphasis('ndvi', ['ndvi'])).toBe(1);
    expect(seriesEmphasis('precipitationMm', ['ndvi'])).toBeLessThan(1);
  });
});

describe('seasonal history', () => {
  it('uses planting date and discloses future and truncated seasons', () => {
    expect(historyRangeFor('2026-05-01', 14, '2026-11-15')).toMatchObject({
      from: '2026-09-25',
      to: '2026-11-15',
    });
    expect(historyRangeFor('2026-05-01', 30, '2026-11-15').from).toBe('2026-09-25');
    expect(historyQueryPeriod(14)).toBe(historyQueryPeriod(30));
    expect(historyQueryPeriod('season')).toBe('season');
    expect(historyRangeFor('2026-05-01', 'season', '2026-11-15').from).toBe('2026-05-01');
    expect(historyRangeFor('2026-11-10', 'season', '2026-11-15').from).toBe('2026-11-10');
    expect(historyRangeFor('2027-05-01', 'season', '2026-11-15').future).toBe(true);
    expect(historyRangeFor('2020-05-01', 'season', '2026-11-15')).toMatchObject({
      from: '2025-11-15',
      truncated: true,
    });
  });
  it('breaks chart lines at absent dates without inventing values', () => {
    const series = makeSeries(3, '2026-11-14');
    const points = withHistoryGaps(toHistoryPoints([series[0], series[2]]));
    expect(points).toHaveLength(3);
    expect(points[1]).toMatchObject({ date: '2026-11-13', ndvi: null, precipitationMm: null });
  });
});

describe('resolveHistoryPeriod', () => {
  const season = {
    hasPlantingDate: true,
    seasonStarted: true,
    status: 'success' as const,
    observationCount: 40,
  };

  it('keeps an explicit choice', () => {
    expect(resolveHistoryPeriod(30, { ...season, observationCount: 0 })).toBe(30);
    expect(resolveHistoryPeriod('season', { ...season, observationCount: 0 })).toBe('season');
  });

  it('shows this season by default when the season has history', () => {
    expect(resolveHistoryPeriod(null, season)).toBe('season');
    expect(resolveHistoryPeriod(null, { ...season, status: 'pending', observationCount: 0 })).toBe(
      'season',
    );
  });

  it('falls back to 14 days without season history', () => {
    expect(resolveHistoryPeriod(null, { ...season, observationCount: 0 })).toBe(14);
    expect(resolveHistoryPeriod(null, { ...season, status: 'error' })).toBe(14);
    expect(resolveHistoryPeriod(null, { ...season, seasonStarted: false })).toBe(14);
    expect(resolveHistoryPeriod(null, { ...season, hasPlantingDate: false })).toBe(14);
  });
});
