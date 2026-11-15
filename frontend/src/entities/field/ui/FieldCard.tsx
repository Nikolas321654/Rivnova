import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { FieldSummary } from '../model/types';
import { Badge, Card } from '@/shared/ui';
import { workabilityLabel } from '../model/guidance';
import { FieldFacts } from './FieldFacts';

type FieldCardProps = {
  field: FieldSummary;
  selected: boolean;
  hovered: boolean;
  selectable: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  mode?: 'select' | 'open';
  actions?: ReactNode;
};

const statusTone = {
  Optimal: 'success',
  Marginal: 'warning',
  Blocked: 'danger',
  Unknown: 'neutral',
} as const;

export function FieldCard({
  field,
  selected,
  hovered,
  selectable,
  onSelect,
  onHover,
  mode = 'select',
  actions,
}: FieldCardProps) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) card.current?.scrollIntoView({ block: 'center' });
  }, [selected]);

  return (
    <Card
      ref={card}
      tone={selected ? 'selected' : 'default'}
      onMouseEnter={() => onHover(field.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(field.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onHover(null);
      }}
      className={`group relative min-w-0 !rounded-control !px-3 !py-2.5 transition-colors ${selected ? '!border-primary' : hovered ? '!border-primary/60' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSelect(field.id)}
        disabled={!selectable}
        aria-pressed={selected}
        aria-label={
          mode === 'open' ? `Open insights for ${field.name}` : `Select ${field.name} on map`
        }
        className="w-full min-w-0 cursor-pointer touch-manipulation rounded-control text-left after:absolute after:inset-0 after:rounded-control after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
      >
        <span className={`block truncate type-item-title ${actions ? 'pr-16' : ''}`}>
          {field.name}
        </span>
        <FieldFacts field={field} facts={['crop', 'area']} size="compact" className="mt-1" />
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={statusTone[field.workabilityStatus] ?? 'neutral'}>
            {workabilityLabel(field.workabilityStatus)} workability
          </Badge>
        </span>
      </button>
      {actions && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
          {actions}
        </div>
      )}
      {!selectable && <p className="mt-2 text-ui-xs text-status-warning">Boundary unavailable</p>}
      {mode === 'select' && (
        <Link
          to={`/fields/${encodeURIComponent(field.id)}`}
          className="relative z-10 mt-1 inline-flex min-h-11 items-center rounded-control text-ui-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-8"
        >
          View insights
        </Link>
      )}
    </Card>
  );
}
