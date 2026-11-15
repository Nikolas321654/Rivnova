import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { WorkabilityWindowPeriod } from '../model/types';
import { withoutLongDashes } from '@/shared/lib/text';
import { workabilityLabel } from '../model/guidance';
import { workabilityTone } from '../model/tones';

type WorkabilityForecastProps = {
  periods: WorkabilityWindowPeriod[];
  unknownLabel?: string;
};

export function WorkabilityForecast({ periods, unknownLabel }: WorkabilityForecastProps) {
  return (
    <ol className="grid grid-cols-3 gap-1.5">
      {periods.map((period) => {
        const tone = workabilityTone[period.status] ?? workabilityTone.Marginal;
        const name = withoutLongDashes(period.period);
        const reason = withoutLongDashes(period.reason);
        return (
          <li
            key={period.period}
            title={reason}
            className={`min-w-0 rounded-control px-2 py-2 ${tone.bg}`}
          >
            <span className="block truncate text-ui-2xs text-text-secondary">{name}</span>
            <span className={`mt-0.5 flex items-center gap-1 text-ui-xs font-medium ${tone.text}`}>
              <FontAwesomeIcon icon={tone.icon} aria-hidden="true" />
              {period.status === 'Unknown'
                ? (unknownLabel ?? workabilityLabel(period.status))
                : period.status}
            </span>
            <span className="sr-only">. {reason}</span>
          </li>
        );
      })}
    </ol>
  );
}
