import { describe, expect, it } from 'vitest';
import { makeYieldPrediction } from '@/entities/field/testing';
import { yieldView } from './yield';

describe('yieldView', () => {
  it('formats the backend values with their units unchanged', () => {
    expect(yieldView(makeYieldPrediction())).toEqual({
      predicted: '6.89',
      harvest: '620',
      baseline: '6.81',
      delta: '+1.2%',
      deltaDirection: 'above',
    });
  });

  it('keeps one decimal and the sign of the backend percentage', () => {
    expect(yieldView(makeYieldPrediction({ deltaVsBaselinePercent: -12.3 }))).toMatchObject({
      delta: '-12.3%',
      deltaDirection: 'below',
    });
    expect(yieldView(makeYieldPrediction({ deltaVsBaselinePercent: 0 }))).toMatchObject({
      delta: '0.0%',
      deltaDirection: 'level',
    });
  });

  it('returns nothing when the predicted yield is missing or invalid', () => {
    expect(yieldView(makeYieldPrediction({ predictedYieldTonsPerHa: Number.NaN }))).toBeNull();
    expect(yieldView(makeYieldPrediction({ predictedYieldTonsPerHa: -1 }))).toBeNull();
    expect(
      yieldView(makeYieldPrediction({ predictedYieldTonsPerHa: undefined as unknown as number })),
    ).toBeNull();
  });

  it('hides only the invalid secondary values', () => {
    const view = yieldView(
      makeYieldPrediction({
        estimatedTotalHarvestTons: Number.NaN,
        regionalBaselineTonsPerHa: 0,
      }),
    );
    expect(view).toMatchObject({ predicted: '6.89', harvest: null, baseline: null, delta: null });
  });
});
