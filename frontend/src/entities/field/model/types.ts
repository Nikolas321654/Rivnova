export type CropType = 'Wheat' | 'Corn' | 'Sunflower' | 'Soy';
export type WorkabilityStatus = 'Optimal' | 'Marginal' | 'Blocked' | 'Unknown';
export type ForecastStatus = WorkabilityStatus | 'Unknown';
export type AlertSeverity = 'Critical' | 'Warning' | 'Info';
export type AlertType =
  | 'SmartIrrigation'
  | 'Predictive72hStress'
  | 'BiomassAnomaly'
  | 'SprayingBlocked'
  | 'WorkabilityBlocked'
  | 'WorkabilityMarginal';

export type ActiveAlert = {
  id: string;
  fieldId: string;
  fieldName: string;
  alertType: AlertType | (string & {});
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAtUtc: string;
  dataSource?: string;
  userFeedbackAccurate?: boolean | null;
};

export type AlertFeedbackRequest = {
  fieldId: string;
  alertType: string;
  isAccurate: boolean;
  comment?: string | null;
};

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: [longitude: number, latitude: number][][];
};

export type FieldSummary = {
  id: string;
  name: string;
  cropType: CropType;
  plantedAt: string;
  areaHectares: number;
  centroidLat: number;
  centroidLon: number;
  workabilityStatus: WorkabilityStatus;
  hasActiveStressAlert: boolean;
  hasBiomassAnomaly: boolean;
  boundary: GeoJsonPolygon;
  isDemo: boolean;
};

export type CreateFieldRequest = {
  name: string;
  cropType: CropType;
  plantedAt: string;
  boundary: GeoJsonPolygon;
};

export type UpdateFieldRequest = Partial<CreateFieldRequest>;

export type CurrentMetrics = {
  precipitationMm24h?: number | null;
  accumulatedPrecipitationMm30d: number;
  surfaceSoilMoisture: number;
  rootzoneSoilMoisture: number;
  solarRadiation: number;
  ndvi: number;
  evaporativeStressIndex: number;
};

export type DashboardWorkability = {
  status: WorkabilityStatus;
  sprayingSafe?: boolean | null;
  rainLast12hMm?: number | null;
  rainLast24hMm?: number | null;
  rainForecast24hMm?: number | null;
  rainForecast24To48hMm?: number | null;
  forecastSource?: string | null;
  recentRainSource?: string | null;
  surfaceMoisture: number;
  recommendation: string;
};

export type DashboardStressAndIrrigation = {
  waterDeficitIndex: number;
  isHiddenStressDetected: boolean;
  severity: AlertSeverity;
  irrigationRecommended: boolean;
  recommendedIrrigationMm: number;
  recommendedWindowHours: number;
  recommendation: string;
};

export type DashboardBiomass = {
  currentNdvi: number;
  ndvi14DayAvg: number;
  deltaNdvi: number;
  deltaPercent: number;
  isAnomalyDetected: boolean;
  recommendation: string;
};

export type ImpactMetrics = {
  estimatedWaterSavedM3PerHa: number;
  preventedRunoffRisk: boolean;
  earlyWarningLeadTimeDays: number;
};

export type NasaDailyMetric = {
  date: string;
  precipitationMm: number;
  surfaceMoisture: number;
  rootzoneMoisture: number;
  solarRadiation: number;
  ndvi: number;
  esi: number;
};

export type FieldDashboard = {
  fieldId: string;
  fieldName: string;
  cropType: CropType;
  areaHectares: number;
  dataSource: 'NASA_POWER_LIVE' | 'MOCK_FIXTURE';
  lastUpdatedUtc: string;
  currentMetrics: CurrentMetrics;
  workability: DashboardWorkability;
  stressAndIrrigation: DashboardStressAndIrrigation;
  biomass: DashboardBiomass;
  impactMetrics: ImpactMetrics;
  timeSeries: NasaDailyMetric[];
};

export type WorkabilityWindowPeriod = {
  period: string;
  status: ForecastStatus;
  reason: string;
};

export type WorkabilityWindow = Omit<DashboardWorkability, 'recommendation'> & {
  fieldId: string;
  forecast48h: WorkabilityWindowPeriod[];
  recommendation: string;
};

export type EarlyStressAlert = {
  fieldId: string;
  waterDeficitIndex: number;
  threshold: number;
  rootzoneMoisture: number;
  cropTargetMoisture: number;
  evaporativeStressIndex: number;
  ndviCurrent: number;
  isHiddenStressDetected: boolean;
  irrigationRecommended: boolean;
  recommendedIrrigationMm: number;
  recommendedWindowHours: number;
  recommendation: string;
};

export type BiomassTrend = {
  fieldId: string;
  currentNdvi: number;
  ndvi14DayAvg: number;
  deltaNdvi: number;
  deltaPercent: number;
  rootzoneMoisture: number;
  isDroughtPresent: boolean;
  isAnomalyDetected: boolean;
  recommendation: string;
};

export type SoilForecastDay = {
  date: string;
  dayOffset: number;
  predictedRootzoneMoisture: number;
  predictedEsi: number;
  predictedWaterDeficitIndex: number;
};

export type SoilForecast = {
  fieldId: string;
  modelName: string;
  proactive72hStressWarning: boolean;
  forecastedDay3WaterDeficitIndex: number;
  proactiveRecommendation: string;
  forecastSeries: SoilForecastDay[];
};

export type YieldFeatures = {
  accumulatedPrecipMm30d: number;
  avgRootzoneMoisture30d: number;
  peakNdvi30d: number;
  stressDaysCount30d: number;
};

export type YieldPrediction = {
  fieldId: string;
  cropType: CropType;
  modelName: string;
  predictedYieldTonsPerHa: number;
  estimatedTotalHarvestTons: number;
  regionalBaselineTonsPerHa: number;
  deltaVsBaselinePercent: number;
  featuresUsed: YieldFeatures;
};

export type RotationPriority = 'Balanced' | 'WaterConservation' | 'MaxYield' | 'SoilHealth';

export type RotationCandidate = {
  cropType: CropType;
  overallScore: number;
  predictedYieldTonsPerHa: number;
  regionalBaselineTonsPerHa: number;
  waterFitScore: number;
  soilHealthScore: number;
  yieldScore: number;
  isRecommendedNext: boolean;
  rationale: string;
};

export type RotationAdvice = {
  fieldId: string;
  fieldName: string;
  currentCropType: CropType;
  priority: RotationPriority;
  observedRootzoneMoisture30d: number;
  recommendedNextCrop: CropType;
  rankedOptions: RotationCandidate[];
};

export type FieldHistory = {
  fieldId: string;
  from: string;
  to: string;
  dataSource: 'NASA_POWER_LIVE' | 'MOCK_FIXTURE';
  latestObservationDate?: string | null;
  timeSeries: NasaDailyMetric[];
};
