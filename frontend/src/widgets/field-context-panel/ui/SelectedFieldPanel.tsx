import {
  faArrowLeft,
  faArrowRight,
  faFlask,
  faPen,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionRow,
  FieldFacts,
  buildFieldActions,
  ndviExplanation,
  observationRange,
  rootzoneExplanation,
  sortActions,
  summarizeProvenance,
  useFieldDashboard,
  useFieldWorkability,
  LeadRecommendation,
  WdiMeter,
  WorkabilityForecast,
  type FieldSummary,
} from '@/entities/field';
import { DeleteFieldDialog } from '@/features/delete-field';
import { withoutLongDashes } from '@/shared/lib/text';
import { Button, ParcelMotif } from '@/shared/ui';
import { AssessmentDetails } from './AssessmentDetails';
import { DataFreshnessFooter } from './DataFreshnessFooter';
import { Sparkline } from './Sparkline';

type SelectedFieldPanelProps = {
  field: FieldSummary;
  onBack: () => void;
  onDeleted: (field: FieldSummary) => void;
};

const trendDays = 14;

export function SelectedFieldPanel({ field, onBack, onDeleted }: SelectedFieldPanelProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dashboardQuery = useFieldDashboard(field.id);
  const workabilityQuery = useFieldWorkability(field.id);
  const dashboard = dashboardQuery.data;

  const actions = dashboard ? sortActions(buildFieldActions(dashboard)) : [];
  const [leadAction, ...otherActions] = actions;
  const series = dashboard?.timeSeries.slice(-trendDays) ?? [];
  const forecast = workabilityQuery.data?.forecast48h ?? [];
  const forecastNote = forecast.find((period) => period.status !== 'Optimal') ?? forecast[0];
  const provenance = dashboard ? summarizeProvenance([dashboard]) : null;
  const simulated = provenance?.simulated ?? false;
  const range = observationRange(series.map((point) => point.date));

  return (
    <>
      <div className="relative shrink-0 border-b border-border/70 px-5 pb-5 pt-4">
        <ParcelMotif />
        <div className="relative pr-10">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-control text-ui-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" /> All fields
          </button>
          <h2 className="break-words type-page-title">{field.name}</h2>
          <FieldFacts field={field} facts={['crop', 'area']} size="compact" className="mt-1.5" />
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5 pt-5"
        aria-live="polite"
      >
        {dashboardQuery.isPending && (
          <p role="status" className="text-ui-sm text-text-secondary">
            Loading field analytics…
          </p>
        )}
        {dashboardQuery.isError && (
          <div role="alert" className="text-ui-sm text-text-secondary">
            <p>Field analytics unavailable.</p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => void dashboardQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        )}

        {dashboard && simulated && !field.isDemo && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-control bg-status-warning-bg px-3 py-2.5"
          >
            <FontAwesomeIcon
              icon={faFlask}
              className="mt-0.5 text-status-warning"
              aria-hidden="true"
            />
            <p className="text-ui-sm text-text-primary">
              Live NASA data is unavailable for this field, so the values below are simulated
              samples. Treat them as illustrative, not as a diagnosis.
            </p>
          </div>
        )}

        {dashboard && (
          <>
            <section aria-label="Recommendation">
              <LeadRecommendation action={leadAction} dashboard={dashboard} simulated={simulated} />
              {otherActions.length > 0 && (
                <ul className="-mx-3 mt-2 space-y-0.5">
                  {otherActions.map((action) => (
                    <li key={action.id}>
                      <ActionRow action={action} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Water stress">
              <WdiMeter stress={dashboard.stressAndIrrigation} />
            </section>

            <section aria-labelledby="trend-title">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p id="trend-title" className="type-section-title">
                  Observations
                </p>
                <p className="type-label tabular-nums">{range ?? 'Dates unavailable'}</p>
              </div>
              <div className="space-y-3">
                <Sparkline
                  label="NDVI"
                  description={ndviExplanation}
                  status={
                    dashboard.biomass.isAnomalyDetected
                      ? { label: 'Decline detected', tone: 'warning' }
                      : { label: 'No anomaly', tone: 'neutral' }
                  }
                  points={series.map((point) => ({ date: point.date, value: point.ndvi }))}
                />
                <Sparkline
                  label="Rootzone moisture"
                  description={rootzoneExplanation}
                  points={series.map((point) => ({
                    date: point.date,
                    value: point.rootzoneMoisture,
                  }))}
                />
              </div>
            </section>
          </>
        )}

        <section aria-label="48 hour workability">
          <p className="mb-2 type-section-title">Workability next 48h</p>
          {workabilityQuery.isPending && (
            <p role="status" className="text-ui-xs text-text-secondary">
              Loading forecast…
            </p>
          )}
          {workabilityQuery.isError && (
            <p role="alert" className="text-ui-xs text-text-secondary">
              Workability forecast unavailable.{' '}
              <button
                type="button"
                onClick={() => void workabilityQuery.refetch()}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Retry
              </button>
            </p>
          )}
          {forecast.length > 0 && (
            <>
              <WorkabilityForecast periods={forecast} />
              {forecastNote && (
                <p className="mt-2 text-ui-xs text-text-secondary">
                  {withoutLongDashes(forecastNote.period)}: {withoutLongDashes(forecastNote.reason)}
                </p>
              )}
              {workabilityQuery.data && (
                <p className="mt-1 text-ui-xs text-text-secondary">
                  {workabilityQuery.data.forecastSource === 'OPEN_METEO_FORECAST'
                    ? 'The 24–48h precipitation forecast comes from Open-Meteo.'
                    : workabilityQuery.data.forecastSource === 'MOCK_FIXTURE'
                      ? 'Precipitation forecasts are simulated fixture values.'
                      : 'Forecast unavailable; future safety cannot be confirmed.'}
                </p>
              )}
            </>
          )}
        </section>

        {dashboard && provenance && (
          <AssessmentDetails
            dashboard={dashboard}
            simulated={provenance.simulated}
            live={provenance.live}
          />
        )}

        <Link
          to={`/fields/${encodeURIComponent(field.id)}`}
          className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-control bg-primary px-4 text-ui-sm font-semibold text-white! hover:bg-primary-hover hover:text-white! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Detailed insights <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
        </Link>
        {!field.isDemo && (
          <Link
            to={`/fields/${encodeURIComponent(field.id)}/edit`}
            className="-mt-3 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-border bg-surface px-4 text-ui-sm font-semibold text-text-primary transition-colors duration-150 hover:border-primary hover:bg-selection focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Edit field
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
          </Link>
        )}
        {!field.isDemo && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-haspopup="dialog"
            className="-mt-3 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-status-danger/40 bg-surface px-4 text-ui-sm font-semibold text-status-danger transition-colors duration-150 hover:border-status-danger hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger motion-reduce:transition-none"
          >
            Delete field
            <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
          </button>
        )}
      </div>

      <DataFreshnessFooter provenance={provenance} />
      {confirmingDelete && (
        <DeleteFieldDialog
          field={field}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
