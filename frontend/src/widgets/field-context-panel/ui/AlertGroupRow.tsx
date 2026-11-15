import { faArrowRight, faChevronDown, faFlask } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId } from 'react';
import {
  actionIcon,
  alertProvenance,
  panelRowInteractive,
  severityTone,
  type AlertAction,
  type AlertGroup,
} from '@/entities/field';
import { AlertFeedback } from '@/features/alert-feedback';
import { InfoTip } from '@/shared/ui';
import type { ActionView } from '../model/actionVisuals';
import { ActionVisual } from './ActionVisual';

type AlertGroupRowProps = {
  group: AlertGroup;
  views: Map<string, ActionView>;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (fieldId: string) => void;
};

const forecastCaveat = 'Model forecast for the next 72 hours. It may not happen.';

function ActionIcon({ action }: { action: AlertAction }) {
  const tone = severityTone[action.severity];
  return (
    <span
      className={`relative grid size-8 shrink-0 place-items-center rounded-control ${tone.bg} ${tone.text}`}
      title={action.severity}
      aria-hidden="true"
    >
      <FontAwesomeIcon icon={actionIcon[action.kind]} />
      <FontAwesomeIcon
        icon={tone.icon}
        className="absolute -bottom-1 -right-1 rounded-full bg-surface text-[10px] ring-2 ring-surface"
      />
    </span>
  );
}

function ActionDetail({ action, view }: { action: AlertAction; view: ActionView | undefined }) {
  const provenance = alertProvenance(action);
  const info = [action.recommendation, action.predicted ? forecastCaveat : null, provenance?.label]
    .filter(Boolean)
    .join(' ');

  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2">
      <ActionIcon action={action} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center type-item-title">
            <span className="sr-only">{action.severity}: </span>
            <span className="min-w-0">{action.title}</span>
            <InfoTip label={action.title} text={info} align="end" />
          </p>
          {view?.visual && <ActionVisual visual={view.visual} size="detail" />}
        </div>
        {view && view.facts.length > 0 && (
          <dl className="mt-1.5 grid grid-cols-3 gap-x-3">
            {view.facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="break-words type-label">{fact.label}</dt>
                <dd className="text-ui-sm font-medium tabular-nums text-text-primary">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {provenance && (
          <p className="mt-1.5 inline-flex items-center gap-1 type-label">
            {provenance.sample && <FontAwesomeIcon icon={faFlask} aria-hidden="true" />}
            {provenance.label}
          </p>
        )}
        <AlertFeedback alert={action} />
      </div>
    </li>
  );
}

export function AlertGroupRow({ group, views, expanded, onToggle, onSelect }: AlertGroupRowProps) {
  const detailsId = useId();
  const { primary, others } = group;
  const primaryView = views.get(primary.id);
  const total = others.length + 1;
  const rowProvenance = alertProvenance(primary);

  return (
    <div className={`rounded-control ${expanded ? 'bg-surface-muted/60' : ''}`}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onSelect(group.fieldId)}
          className={`flex min-w-0 flex-1 items-center gap-3 text-left ${panelRowInteractive}`}
        >
          <ActionIcon action={primary} />
          <span className="min-w-0 flex-1">
            <span
              className="line-clamp-2 break-words type-item-title text-navy"
              title={primary.fieldName}
            >
              {primary.fieldName}
              {rowProvenance?.sample && (
                <span className="ml-1.5 inline-flex align-baseline text-ui-2xs text-text-secondary">
                  <FontAwesomeIcon icon={faFlask} aria-hidden="true" title="Sample data" />
                  <span className="sr-only">, sample data</span>
                </span>
              )}
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-ui-xs text-text-secondary">
                <span className="sr-only">{primary.severity}: </span>
                {primary.title}
              </span>
              {primaryView?.visual && <ActionVisual visual={primaryView.visual} decorative />}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? 'Hide' : 'Show'} ${total === 1 ? 'alert details' : `${total} alerts`} for ${primary.fieldName}`}
          className="flex w-11 shrink-0 items-center justify-center gap-1 rounded-control text-ui-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {others.length > 0 && <span className="tabular-nums">+{others.length}</span>}
          <FontAwesomeIcon
            icon={faChevronDown}
            className={`text-ui-2xs transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {expanded && (
        <div id={detailsId} className="px-3 pb-3 pt-1">
          <ul className="grid gap-4">
            {[primary, ...others].map((action) => (
              <ActionDetail key={action.id} action={action} view={views.get(action.id)} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onSelect(group.fieldId)}
            className="ml-11 mt-3 inline-flex items-center gap-1.5 rounded-control text-ui-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open {primary.fieldName}
            <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
