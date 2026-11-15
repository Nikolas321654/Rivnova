import { describe, expect, it } from 'vitest';
import { makeDashboard, makeSeries } from '../testing';
import { observationRange, summarizeProvenance } from './provenance';

describe('summarizeProvenance', () => {
  it('marks fixture data as simulated without a NASA observation date', () => {
    const provenance = summarizeProvenance([makeDashboard({ dataSource: 'MOCK_FIXTURE' })]);
    expect(provenance).toMatchObject({ live: false, simulated: true, latestObservation: null });
  });

  it('takes the latest observation from the live time series, not from lastUpdatedUtc', () => {
    const provenance = summarizeProvenance([
      makeDashboard({
        dataSource: 'NASA_POWER_LIVE',
        lastUpdatedUtc: '2026-11-14T06:00:00Z',
        timeSeries: makeSeries(5, '2026-11-09'),
      }),
    ]);
    expect(provenance.live).toBe(true);
    expect(provenance.latestObservation).toBe('2026-11-09');
    expect(provenance.generatedAt).toBe('2026-11-14T06:00:00Z');
  });
});

describe('observationRange', () => {
  it('formats the actual first and last dates', () => {
    expect(observationRange(['2026-11-01', '2026-11-14'])).toBe('Nov 1-14, 2026');
    expect(observationRange(['2026-10-28', '2026-11-10'])).toBe('Oct 28-Nov 10, 2026');
  });

  it('returns null for empty or invalid dates', () => {
    expect(observationRange([])).toBeNull();
    expect(observationRange(['2026-11-01', 'bad'])).toBeNull();
  });
});
