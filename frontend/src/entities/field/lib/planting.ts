export type PlantingAge =
  { kind: 'planted'; days: number } | { kind: 'upcoming'; days: number } | null;

const dayMs = 86_400_000;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function utcDay(value: Date): number {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

export function plantingAge(plantedAt: string, today: Date = new Date()): PlantingAge {
  if (!isoDate.test(plantedAt)) return null;
  const planted = Date.parse(plantedAt);
  if (!Number.isFinite(planted)) return null;
  const days = Math.round((utcDay(today) - planted) / dayMs);
  return days >= 0 ? { kind: 'planted', days } : { kind: 'upcoming', days: -days };
}
