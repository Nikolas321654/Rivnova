import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCalendarDays,
  faHourglassHalf,
  faSeedling,
  faRulerCombined,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { plantingAge } from '../lib/planting';
import type { FieldSummary } from '../model/types';

export type FieldFact = 'crop' | 'area' | 'planted' | 'age';

type FieldFactsProps = {
  field: Pick<FieldSummary, 'cropType' | 'areaHectares' | 'plantedAt'>;
  facts?: FieldFact[];
  size?: 'default' | 'compact';
  className?: string;
};

type FactItem = {
  key: FieldFact;
  icon: IconDefinition;
  text: string;
  hiddenLabel?: string;
};

const areaFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function buildFacts(field: FieldFactsProps['field']): Record<FieldFact, FactItem | null> {
  const planted = Date.parse(field.plantedAt);
  const age = plantingAge(field.plantedAt);
  return {
    crop: { key: 'crop', icon: faSeedling, text: field.cropType, hiddenLabel: 'Crop' },
    area: {
      key: 'area',
      icon: faRulerCombined,
      text: `${areaFormatter.format(field.areaHectares)} ha`,
      hiddenLabel: 'Area',
    },
    planted: Number.isFinite(planted)
      ? { key: 'planted', icon: faCalendarDays, text: `Planted ${dateFormatter.format(planted)}` }
      : null,
    age: age
      ? {
          key: 'age',
          icon: faHourglassHalf,
          text:
            age.kind === 'planted'
              ? `${plural(age.days, 'day')} since planting`
              : `Planting in ${plural(age.days, 'day')}`,
        }
      : null,
  };
}

const sizeClasses = {
  default: { list: 'gap-x-5 gap-y-1.5 text-ui-sm', icon: 'w-3.5 text-ui-xs' },
  compact: { list: 'gap-x-3 gap-y-1 text-ui-xs', icon: 'w-3 text-[0.6875rem]' },
} as const;

export function FieldFacts({
  field,
  facts = ['crop', 'area', 'planted', 'age'],
  size = 'default',
  className = '',
}: FieldFactsProps) {
  const available = buildFacts(field);
  const items = facts
    .map((fact) => available[fact])
    .filter((item): item is FactItem => item !== null);
  const styles = sizeClasses[size];

  return (
    <ul
      aria-label="Field details"
      className={`flex flex-wrap items-center text-text-secondary tabular-nums ${styles.list} ${className}`}
    >
      {items.map((item) => (
        <li key={item.key} className="inline-flex min-w-0 items-center gap-1.5">
          <FontAwesomeIcon
            icon={item.icon}
            aria-hidden="true"
            className={`shrink-0 text-text-secondary/70 ${styles.icon}`}
          />
          {item.hiddenLabel && <span className="sr-only">{item.hiddenLabel} </span>}
          <span className="min-w-0">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
