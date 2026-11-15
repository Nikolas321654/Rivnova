import {
  faCheck,
  faChevronDown,
  faCircleExclamation,
  faMinus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, type ReactNode } from 'react';
import type { DecisionCardModel, DecisionTone } from '../model/decisions';
import { InfoTip } from '@/shared/ui';

type DecisionCardProps = {
  card: DecisionCardModel;
  expanded: boolean;
  onToggle: () => void;
  onHighlight: (active: boolean) => void;
  summary?: ReactNode;
  children: ReactNode;
};

const toneStyles: Record<DecisionTone, { pill: string; icon: typeof faCheck }> = {
  success: { pill: 'bg-status-success-bg text-status-success', icon: faCheck },
  warning: { pill: 'bg-status-warning-bg text-status-warning', icon: faTriangleExclamation },
  danger: { pill: 'bg-status-danger-bg text-status-danger', icon: faCircleExclamation },
  neutral: { pill: 'bg-status-neutral-bg text-status-neutral', icon: faMinus },
};

const valueText: Record<DecisionTone, string> = {
  success: '',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  neutral: '',
};

export function DecisionCard({
  card,
  expanded,
  onToggle,
  onHighlight,
  summary,
  children,
}: DecisionCardProps) {
  const tone = toneStyles[card.tone];
  const detailsId = useId();

  return (
    <article
      aria-labelledby={`decision-${card.id}`}
      onMouseEnter={() => onHighlight(true)}
      onMouseLeave={() => onHighlight(false)}
      onFocus={() => onHighlight(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onHighlight(false);
      }}
      className={`flex min-w-0 flex-col rounded-card border bg-surface px-4 py-4 transition-colors duration-200 ${expanded ? 'border-primary/40' : 'border-border/60 hover:border-primary/30'}`}
    >
      <div className="flex flex-col items-start gap-1.5">
        <h3 id={`decision-${card.id}`} className="flex min-w-0 items-center type-section-title">
          {card.title}
          <InfoTip label={card.title} text={card.explanation} />
        </h3>
        <span
          className={`inline-flex max-w-full items-center gap-1.5 rounded-badge px-2.5 py-0.5 text-ui-xs font-medium ${tone.pill}`}
        >
          <FontAwesomeIcon icon={tone.icon} aria-hidden="true" />
          {card.status}
        </span>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span
          className={`text-[1.75rem] leading-none type-metric ${valueText[card.valueTone ?? 'neutral']}`}
        >
          {card.value}
        </span>
        <span className="text-ui-xs text-text-secondary">{card.valueCaption}</span>
      </p>
      <p className="mt-2.5 text-ui-base font-semibold text-text-primary">{card.verdict}</p>
      <p className="mt-1 text-ui-sm text-text-secondary">{card.nextStep}</p>
      {summary && <div className="mt-3">{summary}</div>}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="mt-3 inline-flex items-center gap-1.5 self-start rounded-control text-ui-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {expanded ? 'Hide details' : 'Details'}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-ui-xs transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div id={detailsId} hidden={!expanded} className="mt-3 border-t border-border/70 pt-3">
        {expanded && children}
      </div>
    </article>
  );
}
