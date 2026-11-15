import { faCheck, faThumbsDown, faThumbsUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useRef } from 'react';
import type { AlertAction } from '@/entities/field';
import { useCurrentUser } from '@/entities/user';
import { useAlertFeedback } from '../model/useAlertFeedback';

type AlertFeedbackProps = {
  alert: Pick<AlertAction, 'id' | 'fieldId' | 'alertType' | 'title' | 'userFeedbackAccurate'>;
};

const choiceClass =
  'inline-flex min-h-7 shrink-0 items-center gap-1 rounded-control border px-2 text-ui-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

export function AlertFeedback({ alert }: AlertFeedbackProps) {
  const session = useCurrentUser();
  const feedback = useAlertFeedback(alert);
  const sending = useRef(false);

  if (session.data?.authenticated !== true) return null;

  if (feedback.isSuccess) {
    return (
      <p role="status" className="mt-2 flex w-full items-center gap-1.5 type-label">
        <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
        Thanks, feedback saved.
      </p>
    );
  }
  if (!feedback.isPending && alert.userFeedbackAccurate !== null) return null;

  const answer = feedback.isPending ? feedback.variables : alert.userFeedbackAccurate;
  const choose = (isAccurate: boolean) => {
    if (sending.current || feedback.isPending || answer === isAccurate) return;
    sending.current = true;
    feedback.mutate(isAccurate, {
      onSettled: () => {
        sending.current = false;
      },
    });
  };

  return (
    <div className="mt-2" role="group" aria-label={`Was this alert accurate? ${alert.title}`}>
      <div className="flex items-center gap-1.5" title="Was this alert accurate?">
        <span className="mr-0.5 type-label">Accurate?</span>
        {[true, false].map((value) => {
          const selected = answer === value;
          return (
            <button
              key={String(value)}
              type="button"
              aria-pressed={selected}
              disabled={feedback.isPending}
              onClick={() => choose(value)}
              className={`${choiceClass} ${selected ? 'border-primary bg-selection text-primary' : 'border-border bg-surface text-text-secondary hover:border-primary hover:text-text-primary'}`}
            >
              <FontAwesomeIcon icon={value ? faThumbsUp : faThumbsDown} aria-hidden="true" />
              {value ? 'Yes' : 'No'}
            </button>
          );
        })}
      </div>
      {feedback.isError && (
        <p role="alert" className="mt-1 text-ui-xs text-status-danger">
          Feedback was not saved. Try again.
        </p>
      )}
    </div>
  );
}
