import type { FieldDashboard } from '@/entities/field';

export type ImpactSummary = {
  waterSavedM3: number;
  waterSavedM3PerHa: number;
  maxLeadTimeDays: number;
  runoffPreventedFields: number;
};

export function summarizeImpact(dashboards: FieldDashboard[]): ImpactSummary | null {
  if (dashboards.length === 0) return null;
  const totalArea = dashboards.reduce((sum, item) => sum + item.areaHectares, 0);
  const waterSavedM3 = dashboards.reduce(
    (sum, item) => sum + item.impactMetrics.estimatedWaterSavedM3PerHa * item.areaHectares,
    0,
  );
  return {
    waterSavedM3,
    waterSavedM3PerHa: totalArea > 0 ? waterSavedM3 / totalArea : 0,
    maxLeadTimeDays: Math.max(
      ...dashboards.map((item) => item.impactMetrics.earlyWarningLeadTimeDays),
    ),
    runoffPreventedFields: dashboards.filter((item) => item.impactMetrics.preventedRunoffRisk)
      .length,
  };
}
