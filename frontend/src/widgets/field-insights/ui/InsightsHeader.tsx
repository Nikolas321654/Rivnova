import { faArrowLeft, faFlask, faPen, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import { FieldFacts, type FieldSummary } from '@/entities/field';

type InsightsHeaderProps = {
  field: FieldSummary;
};

export function InsightsHeader({ field }: InsightsHeaderProps) {
  return (
    <header className="min-w-0">
      <Link
        to={`/?field=${encodeURIComponent(field.id)}`}
        className="inline-flex min-h-9 items-center gap-2 rounded-control text-ui-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
        Back to Field Explorer
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="mr-1 min-w-0 break-words type-page-title">{field.name}</h1>
        <span className="inline-flex items-center gap-1.5 rounded-badge border border-border bg-surface px-2.5 py-0.5 text-ui-xs font-medium text-text-secondary">
          <FontAwesomeIcon icon={field.isDemo ? faFlask : faUser} aria-hidden="true" />
          {field.isDemo ? 'Demo field' : 'My field'}
        </span>
        {!field.isDemo && (
          <Link
            to={`/fields/${encodeURIComponent(field.id)}/edit`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-control px-2 text-ui-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
            Edit field
          </Link>
        )}
      </div>
      <FieldFacts field={field} className="mt-3" />
    </header>
  );
}
