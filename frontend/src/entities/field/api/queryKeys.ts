export const fieldQueryKeys = {
  all: ['fields'] as const,
  history: (id: string, from: string, to: string, period: string) =>
    ['fields', 'detail', id, 'history', from, to, period] as const,
  list: () => ['fields', 'list'] as const,
  alerts: () => ['fields', 'alerts'] as const,
  details: () => ['fields', 'detail'] as const,
  detail: (id: string) => ['fields', 'detail', id] as const,
  dashboard: (id: string, days?: number) =>
    ['fields', 'detail', id, 'dashboard', days ?? 14] as const,
  workability: (id: string) => ['fields', 'detail', id, 'workability'] as const,
  stress: (id: string) => ['fields', 'detail', id, 'stress'] as const,
  biomass: (id: string) => ['fields', 'detail', id, 'biomass'] as const,
  soilForecast: (id: string) => ['fields', 'detail', id, 'soil-forecast'] as const,
  yieldPrediction: (id: string) => ['fields', 'detail', id, 'yield-prediction'] as const,
  rotationAdvice: (id: string, priority: string) =>
    ['fields', 'detail', id, 'rotation-advice', priority] as const,
};
