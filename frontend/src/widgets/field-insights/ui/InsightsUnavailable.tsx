import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui';

type InsightsUnavailableProps = {
  kind: 'missing' | 'error';
  onRetry?: () => void;
};

export function InsightsUnavailable({ kind, onRetry }: InsightsUnavailableProps) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className="mx-auto max-w-lg py-16 text-center"
    >
      <h1 className="type-page-title">
        {kind === 'missing' ? 'Field not available' : 'Field could not be loaded'}
      </h1>
      <p className="mt-2 text-ui-sm text-text-secondary">
        {kind === 'missing'
          ? 'This field does not exist, or it is not available to your account.'
          : 'Rivnova could not reach the server. Check your connection and try again.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {kind === 'error' && onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-ui-sm font-semibold text-white! hover:bg-primary-hover hover:text-white! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          Field Explorer
        </Link>
      </div>
    </div>
  );
}
