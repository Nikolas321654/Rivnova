import type { YieldPrediction } from '@/entities/field';

export type YieldView = {
  predicted: string;
  harvest: string | null;
  baseline: string | null;
  delta: string | null;
  deltaDirection: 'above' | 'below' | 'level' | null;
};

const perHectare = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tons = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function yieldView(prediction: YieldPrediction): YieldView | null {
  const {
    predictedYieldTonsPerHa,
    estimatedTotalHarvestTons,
    regionalBaselineTonsPerHa,
    deltaVsBaselinePercent,
  } = prediction;
  if (!isNonNegative(predictedYieldTonsPerHa)) return null;

  const hasBaseline = isNonNegative(regionalBaselineTonsPerHa) && regionalBaselineTonsPerHa > 0;
  const hasDelta =
    hasBaseline &&
    typeof deltaVsBaselinePercent === 'number' &&
    Number.isFinite(deltaVsBaselinePercent);

  return {
    predicted: perHectare.format(predictedYieldTonsPerHa),
    harvest: isNonNegative(estimatedTotalHarvestTons)
      ? tons.format(estimatedTotalHarvestTons)
      : null,
    baseline: hasBaseline ? perHectare.format(regionalBaselineTonsPerHa) : null,
    delta: hasDelta ? `${percent.format(deltaVsBaselinePercent)}%` : null,
    deltaDirection: hasDelta
      ? deltaVsBaselinePercent > 0
        ? 'above'
        : deltaVsBaselinePercent < 0
          ? 'below'
          : 'level'
      : null,
  };
}
