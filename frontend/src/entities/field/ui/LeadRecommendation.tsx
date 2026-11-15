import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MetaList } from '@/shared/ui';
import { fieldMessage, type FieldAction } from '../model/actions';
import { severityTone } from '../model/tones';
import type { FieldDashboard } from '../model/types';

type LeadRecommendationProps = {
  action: FieldAction | undefined;
  dashboard: FieldDashboard;
  simulated: boolean;
};

export function LeadRecommendation({ action, dashboard, simulated }: LeadRecommendationProps) {
  if (action) {
    return (
      <div
        className={`rounded-control border-l-4 bg-surface-muted px-3 py-3 ${severityTone[action.severity].text}`}
        style={{ borderLeftColor: 'currentColor' }}
      >
        <MetaList className="type-label font-medium text-current">
          {action.severity}
          Do first
        </MetaList>
        <p className="mt-1 text-ui-base font-semibold text-text-primary">
          {action.title}: {action.detail}
        </p>
        <p className="mt-1 text-ui-sm text-text-secondary">{action.recommendation}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 rounded-control bg-status-success-bg px-3 py-3">
      <FontAwesomeIcon
        icon={faCircleCheck}
        className="mt-0.5 text-status-success"
        aria-hidden="true"
      />
      <div>
        <p className="type-item-title">
          {simulated ? 'No action in this sample data' : 'No action needed today'}
        </p>
        <p className="mt-1 text-ui-sm text-text-secondary">
          {fieldMessage(dashboard.workability.recommendation, dashboard.fieldName)}
        </p>
      </div>
    </div>
  );
}
