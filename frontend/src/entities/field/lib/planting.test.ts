import { describe, expect, it } from 'vitest';
import { plantingAge } from './planting';

const today = new Date(2026, 10, 14);

describe('plantingAge', () => {
  it('counts whole days since planting', () => {
    expect(plantingAge('2026-11-04', today)).toEqual({ kind: 'planted', days: 10 });
    expect(plantingAge('2026-11-14', today)).toEqual({ kind: 'planted', days: 0 });
  });

  it('reports future planting dates without negative numbers', () => {
    expect(plantingAge('2026-11-20', today)).toEqual({ kind: 'upcoming', days: 6 });
  });

  it('returns null for invalid dates', () => {
    expect(plantingAge('2026-13-40', today)).toBeNull();
    expect(plantingAge('soon', today)).toBeNull();
  });
});
