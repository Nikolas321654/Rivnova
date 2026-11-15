import type {
  ActiveAlert,
  FieldDashboard,
  FieldSummary,
  NasaDailyMetric,
  RotationAdvice,
  SoilForecast,
  WorkabilityWindow,
  YieldPrediction,
} from './model/types';

export const demoFieldId = '22222222-2222-2222-2222-222222222222';

export function makeSeries(days: number, lastDate = '2026-11-14'): NasaDailyMetric[] {
  const last = Date.parse(lastDate);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(last - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return {
      date,
      precipitationMm: index % 4 === 0 ? 3.2 : 0,
      surfaceMoisture: 0.31 - index * 0.004,
      rootzoneMoisture: 0.38 - index * 0.005,
      solarRadiation: 14.2,
      ndvi: 0.76 - index * 0.001,
      esi: 0.5,
    };
  });
}

export function makeFieldSummary(overrides: Partial<FieldSummary> = {}): FieldSummary {
  return {
    id: demoFieldId,
    name: 'Field #2 \u2014 North Corn',
    cropType: 'Corn',
    plantedAt: '2026-04-20',
    areaHectares: 89.98,
    centroidLat: 49.2,
    centroidLon: 30.5,
    workabilityStatus: 'Optimal',
    hasActiveStressAlert: true,
    hasBiomassAnomaly: false,
    isDemo: true,
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [30.5, 49.2],
          [30.51, 49.2],
          [30.51, 49.21],
          [30.5, 49.21],
          [30.5, 49.2],
        ],
      ],
    },
    ...overrides,
  };
}

export function makeDashboard(overrides: Partial<FieldDashboard> = {}): FieldDashboard {
  return {
    fieldId: demoFieldId,
    fieldName: 'Field #2 \u2014 North Corn',
    cropType: 'Corn',
    areaHectares: 89.98,
    dataSource: 'MOCK_FIXTURE',
    lastUpdatedUtc: '2026-11-14T06:00:00Z',
    currentMetrics: {
      precipitationMm24h: 0.4,
      accumulatedPrecipitationMm30d: 28.5,
      surfaceSoilMoisture: 0.21,
      rootzoneSoilMoisture: 0.19,
      solarRadiation: 16.8,
      ndvi: 0.74,
      evaporativeStressIndex: 0.32,
    },
    workability: {
      status: 'Optimal',
      sprayingSafe: true,
      rainLast12hMm: 0,
      rainLast24hMm: 0.4,
      rainForecast24hMm: 1.2,
      rainForecast24To48hMm: 0.5,
      forecastSource: 'MOCK_FIXTURE',
      surfaceMoisture: 0.21,
      recommendation: 'Soil bearing capacity is optimal and washout risk is low.',
    },
    stressAndIrrigation: {
      waterDeficitIndex: 0.78,
      isHiddenStressDetected: true,
      severity: 'Warning',
      irrigationRecommended: true,
      recommendedIrrigationMm: 22.2,
      recommendedWindowHours: 36,
      recommendation:
        'Field #2 \u2014 North Corn: Hidden water stress detected. Recommended irrigation dose of 22.2 mm within 36 hours.',
    },
    biomass: {
      currentNdvi: 0.74,
      ndvi14DayAvg: 0.75,
      deltaNdvi: -0.01,
      deltaPercent: -1.3,
      isAnomalyDetected: false,
      recommendation:
        'Field #2 \u2014 North Corn: Biomass growth trajectory is within normal seasonal bounds.',
    },
    impactMetrics: {
      estimatedWaterSavedM3PerHa: 66.6,
      preventedRunoffRisk: false,
      earlyWarningLeadTimeDays: 4,
    },
    timeSeries: makeSeries(14),
    ...overrides,
  };
}

export function makeWorkabilityWindow(
  overrides: Partial<WorkabilityWindow> = {},
): WorkabilityWindow {
  return {
    fieldId: demoFieldId,
    status: 'Optimal',
    sprayingSafe: true,
    rainLast12hMm: 0,
    rainLast24hMm: 0.4,
    rainForecast24hMm: 1.2,
    rainForecast24To48hMm: 0.5,
    forecastSource: 'MOCK_FIXTURE',
    surfaceMoisture: 0.21,
    forecast48h: [
      { period: 'Today', status: 'Optimal', reason: 'Dry topsoil and clear weather window' },
      { period: 'Next 24h', status: 'Optimal', reason: 'Dry topsoil and clear weather window' },
      { period: '24h-48h', status: 'Marginal', reason: 'Surface drying in progress' },
    ],
    recommendation: 'Soil bearing capacity is optimal and washout risk is low.',
    ...overrides,
  };
}

export function makeSoilForecast(
  overrides: Partial<SoilForecast> = {},
  firstDate = '2026-11-15',
): SoilForecast {
  const start = Date.parse(firstDate);
  return {
    fieldId: demoFieldId,
    modelName: 'soil_forecast.onnx',
    proactive72hStressWarning: false,
    forecastedDay3WaterDeficitIndex: 0.52,
    proactiveRecommendation: `${makeFieldSummary().name}: No proactive stress expected within 72 hours.`,
    forecastSeries: Array.from({ length: 7 }, (_, index) => ({
      date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
      dayOffset: index + 1,
      predictedRootzoneMoisture: 0.3 - index * 0.01,
      predictedEsi: 0.45,
      predictedWaterDeficitIndex: 0.5 + index * 0.01,
    })),
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<ActiveAlert> = {}): ActiveAlert {
  const fieldName = overrides.fieldName ?? makeFieldSummary().name;
  return {
    id: '1cc2cea2-3549-a622-50a4-bfb666b14297',
    fieldId: demoFieldId,
    fieldName,
    alertType: 'SmartIrrigation',
    severity: 'Warning',
    title: 'Hidden Water Stress \u2014 Preventive Irrigation Needed',
    message: `${fieldName}: Recommended irrigation dose of 22.2 mm within 36 hours.`,
    createdAtUtc: '2026-11-15T06:00:00Z',
    dataSource: 'MOCK_FIXTURE',
    ...overrides,
  };
}

export function makeYieldPrediction(overrides: Partial<YieldPrediction> = {}): YieldPrediction {
  return {
    fieldId: demoFieldId,
    cropType: 'Corn',
    modelName: 'yield_model.onnx',
    predictedYieldTonsPerHa: 6.89,
    estimatedTotalHarvestTons: 619.96,
    regionalBaselineTonsPerHa: 6.81,
    deltaVsBaselinePercent: 1.2,
    featuresUsed: {
      accumulatedPrecipMm30d: 28.5,
      avgRootzoneMoisture30d: 0.304,
      peakNdvi30d: 0.75,
      stressDaysCount30d: 10,
    },
    ...overrides,
  };
}

export function makeRotationAdvice(overrides: Partial<RotationAdvice> = {}): RotationAdvice {
  const option = (
    cropType: RotationAdvice['currentCropType'],
    overallScore: number,
    isRecommendedNext = false,
  ) => ({
    cropType,
    overallScore,
    predictedYieldTonsPerHa: 2.5 + overallScore / 100,
    regionalBaselineTonsPerHa: 2.4,
    waterFitScore: overallScore,
    soilHealthScore: 95,
    yieldScore: 60,
    isRecommendedNext,
    rationale: `${cropType} rationale from the backend.`,
  });
  return {
    fieldId: demoFieldId,
    fieldName: 'Field #2 — North Corn',
    currentCropType: 'Corn',
    priority: 'Balanced',
    observedRootzoneMoisture30d: 0.3,
    recommendedNextCrop: 'Soy',
    rankedOptions: [
      option('Soy', 82, true),
      option('Wheat', 70),
      option('Sunflower', 61),
      option('Corn', 30),
    ],
    ...overrides,
  };
}
