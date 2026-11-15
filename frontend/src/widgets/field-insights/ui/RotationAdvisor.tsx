import { faChevronDown, faSeedling } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, useState } from 'react';
import {
  useFieldRotationAdvice,
  type CropType,
  type RotationCandidate,
  type RotationPriority,
} from '@/entities/field';
import { Button, Card, InfoTip } from '@/shared/ui';

type RotationAdvisorProps = {
  fieldId: string;
  currentCrop: CropType;
  simulated: boolean;
};

const priorities: { value: RotationPriority; label: string }[] = [
  { value: 'Balanced', label: 'Balanced' },
  { value: 'WaterConservation', label: 'Save water' },
  { value: 'MaxYield', label: 'Max yield' },
  { value: 'SoilHealth', label: 'Soil health' },
];

const perHectare = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const score = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function ScoreBar({ label, value }: { label: string; value: number }) {
  const width = `${Math.min(Math.max(value, 0), 100)}%`;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="type-label">{label}</span>
        <span className="text-ui-xs font-medium tabular-nums text-text-primary">
          {score.format(value)}
          <span className="font-normal text-text-secondary">/100</span>
        </span>
      </div>
      <span className="mt-1 block h-1.5 rounded-full bg-border/60">
        <span className="block h-full rounded-full bg-primary" style={{ width }} />
      </span>
    </div>
  );
}

function CandidateRow({ candidate, current }: { candidate: RotationCandidate; current: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-t border-border/60 py-2.5 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <p className="flex min-w-0 items-center type-item-title">
        <span className="truncate">{candidate.cropType}</span>
        {current && <span className="ml-1.5 shrink-0 type-label">current</span>}
        <InfoTip label={`${candidate.cropType} rotation`} text={candidate.rationale} />
      </p>
      <p className="text-ui-sm tabular-nums text-text-primary sm:col-auto">
        {perHectare.format(candidate.predictedYieldTonsPerHa)}
        <span className="ml-1 text-ui-xs text-text-secondary">t/ha</span>
      </p>
      <div className="col-span-2 grid grid-cols-2 gap-x-4 sm:col-span-2">
        <ScoreBar label="Water fit" value={candidate.waterFitScore} />
        <ScoreBar label="Soil health" value={candidate.soilHealthScore} />
      </div>
    </li>
  );
}

export function RotationAdvisor({ fieldId, currentCrop, simulated }: RotationAdvisorProps) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<RotationPriority>('Balanced');
  const bodyId = useId();
  const query = useFieldRotationAdvice(fieldId, priority, { enabled: open });
  const advice = query.data?.fieldId === fieldId ? query.data : undefined;
  const recommended = advice?.rankedOptions.find((option) => option.isRecommendedNext);
  const alternatives = advice?.rankedOptions.filter((option) => !option.isRecommendedNext) ?? [];

  return (
    <Card tone="muted" className="grid gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-control text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-control bg-selection text-primary">
            <FontAwesomeIcon icon={faSeedling} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block type-item-title">Plan the next season</span>
            <span className="block type-label">
              Model-ranked rotation options after {currentCrop}
            </span>
          </span>
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`shrink-0 text-ui-xs text-text-secondary transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={bodyId} className="grid gap-4">
          <div
            role="group"
            aria-label="Rotation priority"
            className="flex flex-wrap gap-1 rounded-control bg-surface p-1"
          >
            {priorities.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={priority === option.value}
                onClick={() => setPriority(option.value)}
                className={`min-h-9 rounded-control px-3 text-ui-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${priority === option.value ? 'bg-selection text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {query.isPending && !advice && (
            <p role="status" className="text-ui-sm text-text-secondary">
              Ranking rotation options…
            </p>
          )}
          {query.isError && !advice && (
            <div role="alert" className="text-ui-sm text-text-secondary">
              <p>Rotation advice is unavailable right now.</p>
              <Button variant="secondary" className="mt-3" onClick={() => void query.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {advice && recommended && (
            <div
              className={`grid gap-3 transition-opacity duration-300 ${query.isPlaceholderData ? 'opacity-60' : 'opacity-100'}`}
            >
              <div className="rounded-control border border-border bg-surface px-4 py-3">
                <p className="type-label">Suggested next crop</p>
                <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="flex items-center type-metric text-navy">
                    {recommended.cropType}
                    <InfoTip
                      label={`${recommended.cropType} rotation`}
                      text={recommended.rationale}
                    />
                  </p>
                  <p className="text-ui-sm tabular-nums text-text-primary">
                    {perHectare.format(recommended.predictedYieldTonsPerHa)}
                    <span className="ml-1 text-ui-xs text-text-secondary">t/ha predicted</span>
                    <span className="ml-2 text-ui-xs text-text-secondary">
                      baseline {perHectare.format(recommended.regionalBaselineTonsPerHa)}
                    </span>
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4">
                  <ScoreBar label="Water fit" value={recommended.waterFitScore} />
                  <ScoreBar label="Soil health" value={recommended.soilHealthScore} />
                </div>
              </div>

              {alternatives.length > 0 && (
                <div>
                  <p className="type-section-title">Other options, ranked</p>
                  <ul className="mt-1">
                    {alternatives.map((candidate) => (
                      <CandidateRow
                        key={candidate.cropType}
                        candidate={candidate}
                        current={candidate.cropType === advice.currentCropType}
                      />
                    ))}
                  </ul>
                </div>
              )}

              <p className="type-label">
                Scores and yields are model-based estimates from the last 30 days of field signals
                {simulated ? ', here from simulated sample data' : ''}. Use them for planning, not
                as a guaranteed outcome.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
