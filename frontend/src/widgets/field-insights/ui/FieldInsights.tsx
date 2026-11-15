import { faFlask } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useState } from 'react';
import {
  isValidFieldId,
  observationRange,
  summarizeProvenance,
  useField,
  useFieldBiomass,
  useFieldDashboard,
  useFieldHistory,
  useFieldSoilForecast,
  useFieldStress,
  useFieldWorkability,
  useFieldYieldPrediction,
  unconfirmedStatusLabel,
  WorkabilityForecast,
} from '@/entities/field';
import { ApiError } from '@/shared/api';
import { Button, InfoTip } from '@/shared/ui';
import { buildDecisionCards, buildTodaysPlan, type DecisionCardModel } from '../model/decisions';
import {
  lastObservationDate,
  historyQueryPeriod,
  historyRangeFor,
  withHistoryGaps,
  mergeMoistureForecast,
  resolveHistoryPeriod,
  toHistoryPoints,
  type HistoryDays,
} from '../model/history';
import { buildDayLookup, decisionSeries, seriesOrder, type SeriesKey } from '../model/series';
import { ConditionGroups } from './ConditionGroups';
import { DecisionCard } from './DecisionCard';
import { FieldBoundaryMap } from './FieldBoundaryMap';
import { ForecastNotice } from './ForecastNotice';
import { HistoryDaysToggle } from './HistoryDaysToggle';
import { InsightSection } from './InsightSection';
import { InsightsHeader } from './InsightsHeader';
import { InsightsUnavailable } from './InsightsUnavailable';
import { MoistureForecastChart } from './MoistureForecastChart';
import { NdviHistoryChart } from './NdviHistoryChart';
import { RotationAdvisor } from './RotationAdvisor';
import { SeriesLegend } from './SeriesLegend';
import { VegetationSection } from './VegetationSection';
import { WaterStressSection } from './WaterStressSection';
import { WorkabilitySection } from './WorkabilitySection';
import { YieldEstimate } from './YieldEstimate';

type FieldInsightsProps = {
  fieldId: string | undefined;
  days: HistoryDays | null;
  onDaysChange: (days: HistoryDays) => void;
};

function isUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'not-found' || error.kind === 'unauthorized' || error.kind === 'forbidden')
  );
}

export function FieldInsights({ fieldId, days: requestedDays, onDaysChange }: FieldInsightsProps) {
  const [expanded, setExpanded] = useState<DecisionCardModel['id'] | null>(null);
  const [hidden, setHidden] = useState<Set<SeriesKey>>(() => new Set());
  const [highlight, setHighlight] = useState<SeriesKey[] | null>(null);
  const fieldQuery = useField(fieldId);
  const dashboardQuery = useFieldDashboard(fieldId);
  const plantedAt = fieldQuery.data?.plantedAt;
  const seasonRange = historyRangeFor(plantedAt, 'season');
  const seasonQuery = useFieldHistory(
    fieldId,
    seasonRange.future ? '' : seasonRange.from,
    seasonRange.to,
    'season',
  );
  const days = resolveHistoryPeriod(requestedDays, {
    hasPlantingDate: Boolean(plantedAt),
    seasonStarted: !seasonRange.future,
    status: seasonQuery.status,
    observationCount: seasonQuery.data?.timeSeries.length ?? 0,
  });
  const autoFellBack = requestedDays === null && days !== 'season';
  const range = historyRangeFor(plantedAt, days);
  const historyQuery = useFieldHistory(fieldId, range.from, range.to, historyQueryPeriod(days));
  const workabilityQuery = useFieldWorkability(fieldId);
  const stressQuery = useFieldStress(fieldId);
  const biomassQuery = useFieldBiomass(fieldId);
  const forecastQuery = useFieldSoilForecast(fieldId);
  const yieldQuery = useFieldYieldPrediction(fieldId);

  const historyPoints = useMemo(() => {
    const observations = historyQuery.data ? toHistoryPoints(historyQuery.data.timeSeries) : [];
    return days === 'season' ? observations : observations.slice(-days);
  }, [historyQuery.data, days]);
  const forecastMatchesHistory = Boolean(
    historyQuery.data &&
    dashboardQuery.data &&
    historyQuery.data.dataSource === dashboardQuery.data.dataSource &&
    lastObservationDate(historyPoints) === dashboardQuery.data.timeSeries.at(-1)?.date,
  );
  const moistureRows = useMemo(
    () =>
      mergeMoistureForecast(
        withHistoryGaps(historyPoints),
        historyPoints.length && forecastMatchesHistory
          ? forecastQuery.data?.forecastSeries
          : undefined,
      ),
    [historyPoints, forecastQuery.data, forecastMatchesHistory],
  );
  const lookup = useMemo(
    () => buildDayLookup(historyPoints, moistureRows),
    [historyPoints, moistureRows],
  );

  if (!isValidFieldId(fieldId)) return <InsightsUnavailable kind="missing" />;
  if (fieldQuery.isPending) {
    return (
      <p role="status" className="py-16 text-center text-ui-sm text-text-secondary">
        Loading field…
      </p>
    );
  }
  if (fieldQuery.isError) {
    return isUnavailable(fieldQuery.error) ? (
      <InsightsUnavailable kind="missing" />
    ) : (
      <InsightsUnavailable kind="error" onRetry={() => void fieldQuery.refetch()} />
    );
  }

  const field = fieldQuery.data;
  const dashboard = dashboardQuery.data;
  const provenance = dashboard ? summarizeProvenance([dashboard]) : null;
  const cards = dashboard
    ? buildDecisionCards(dashboard, stressQuery.data, biomassQuery.data?.isDroughtPresent)
    : [];
  const historyRange = observationRange(historyPoints.map((point) => point.date));
  const lastObservation = lastObservationDate(historyPoints);
  const legendSeries = seriesOrder.filter(
    (key) =>
      key !== 'forecastRootzoneMoisture' ||
      moistureRows.some((row) => row.forecastRootzoneMoisture !== null),
  );
  const periods = workabilityQuery.data?.forecast48h ?? [];

  const toggleSeries = (key: SeriesKey) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const detailFor = (id: DecisionCardModel['id']) => {
    if (!dashboard || !provenance) return null;
    if (id === 'water')
      return <WaterStressSection dashboard={dashboard} stress={stressQuery.data} />;
    if (id === 'vegetation')
      return <VegetationSection dashboard={dashboard} biomass={biomassQuery.data} />;
    return (
      <WorkabilitySection
        dashboard={dashboard}
        window={workabilityQuery.data}
        windowState={workabilityQuery.status}
        onRetryWindow={() => void workabilityQuery.refetch()}
      />
    );
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-7 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="grid gap-2">
        <InsightsHeader field={field} />
        {dashboard && (
          <p className="flex flex-wrap items-center gap-x-2 rounded-control border border-border bg-surface px-3 py-2 text-ui-sm text-text-primary">
            <span className="font-display text-navy">Today's plan</span>
            <span className="min-w-0 flex-1">{buildTodaysPlan(dashboard)}</span>
            <InfoTip
              label="today's plan"
              text="Combines the irrigation, workability and vegetation checks below. Recent rain for live fields is an Open-Meteo estimate, so confirm on site after heavy showers."
              align="end"
            />
          </p>
        )}
        {dashboard && provenance?.simulated && (
          <p
            role="status"
            className={`inline-flex w-fit items-center gap-1.5 rounded-badge px-2.5 py-0.5 text-ui-xs font-medium ${field.isDemo ? 'bg-status-neutral-bg text-status-neutral' : 'bg-status-warning-bg text-status-warning'}`}
          >
            <FontAwesomeIcon icon={faFlask} aria-hidden="true" />
            {field.isDemo ? 'Sample data' : 'Live NASA data unavailable'}
            <InfoTip
              label="simulated data"
              text={
                field.isDemo
                  ? 'Demo field with simulated sample data. The boundary is illustrative, not a verified parcel.'
                  : 'Live NASA data is unavailable for this field, so the values below are simulated samples. Treat them as illustrative, not as a diagnosis.'
              }
            />
          </p>
        )}
      </div>

      <section aria-label="Field assessments">
        {dashboardQuery.isPending && (
          <p role="status" className="text-ui-sm text-text-secondary">
            Loading field analytics…
          </p>
        )}
        {dashboardQuery.isError && (
          <div role="alert" className="text-ui-sm text-text-secondary">
            <p>Field analytics are unavailable right now.</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void dashboardQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {cards.length > 0 && (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <DecisionCard
                key={card.id}
                card={card}
                expanded={expanded === card.id}
                onToggle={() => setExpanded((current) => (current === card.id ? null : card.id))}
                onHighlight={(active) => setHighlight(active ? decisionSeries[card.id] : null)}
                summary={
                  card.id === 'workability' && periods.length > 0 ? (
                    <WorkabilityForecast periods={periods} unknownLabel={unconfirmedStatusLabel} />
                  ) : undefined
                }
              >
                {detailFor(card.id)}
              </DecisionCard>
            ))}
          </div>
        )}
      </section>

      <InsightSection title="Current conditions">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
          {dashboard ? (
            <ConditionGroups
              dashboard={dashboard}
              stress={stressQuery.data}
              biomass={biomassQuery.data}
              points={toHistoryPoints(dashboard.timeSeries)}
              highlight={highlight}
              onHighlight={setHighlight}
            />
          ) : (
            <p className="text-ui-sm text-text-secondary">
              {dashboardQuery.isPending
                ? 'Loading conditions…'
                : 'Conditions are unavailable right now.'}
            </p>
          )}
          <div className="h-48 lg:h-auto lg:min-h-44">
            <FieldBoundaryMap boundary={field.boundary} label={field.name} />
          </div>
        </div>
      </InsightSection>

      <InsightSection
        title="History"
        description={historyRange ?? undefined}
        aside={
          <div className="flex items-center gap-1">
            {historyQuery.data && (
              <InfoTip
                label="the history data"
                text={
                  historyQuery.data.dataSource === 'MOCK_FIXTURE'
                    ? 'Simulated fixture history; only existing sample dates are available.'
                    : 'NASA POWER daily inputs; NDVI and ESI are derived estimates. Missing days are gaps. Dashed ONNX values are predictions.'
                }
                align="end"
              />
            )}
            <HistoryDaysToggle value={days} onChange={onDaysChange} />
          </div>
        }
      >
        {range.future && (
          <p className="text-ui-sm text-text-secondary">
            This season has not started. The planting date is in the future.
          </p>
        )}
        {autoFellBack && plantedAt && (
          <p className="mb-3 text-ui-xs text-text-secondary">
            {seasonRange.future
              ? 'This season has not started yet, so the last 14 days are shown.'
              : 'No observations for this season yet, so the last 14 days are shown.'}
          </p>
        )}
        {range.truncated && (
          <p className="text-ui-sm text-text-secondary">
            This season exceeds the supported range. Showing only the last 366 calendar days.
          </p>
        )}
        {historyQuery.isPending && !range.future && (
          <p role="status" className="text-ui-sm text-text-secondary">
            Loading observations…
          </p>
        )}
        {historyQuery.isError && (
          <div role="alert" className="text-ui-sm text-text-secondary">
            <p>Historical observations are unavailable right now.</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void historyQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {historyQuery.data && historyPoints.length === 0 && (
          <p className="text-ui-sm text-text-secondary">
            No observations available for this period.
          </p>
        )}
        {historyPoints.length > 0 && (
          <div
            className={`grid gap-5 transition-opacity duration-300 ${historyQuery.isPlaceholderData ? 'opacity-60' : 'opacity-100'}`}
          >
            <SeriesLegend
              series={legendSeries}
              hidden={hidden}
              onToggle={toggleSeries}
              onHighlight={setHighlight}
            />
            <NdviHistoryChart
              points={withHistoryGaps(historyPoints)}
              average={dashboard?.biomass.ndvi14DayAvg}
              anomaly={dashboard?.biomass.isAnomalyDetected ?? false}
              hidden={hidden}
              highlight={highlight}
              lookup={lookup}
            />
            <div className="grid gap-2">
              <MoistureForecastChart
                rows={moistureRows}
                lastObservation={
                  forecastQuery.data && forecastMatchesHistory ? lastObservation : null
                }
                cropTarget={stressQuery.data?.cropTargetMoisture}
                hidden={hidden}
                highlight={highlight}
                lookup={lookup}
              />
              {forecastMatchesHistory ? (
                <ForecastNotice
                  forecast={forecastQuery.data}
                  state={forecastQuery.status}
                  forecastStart={lastObservation}
                  onRetry={() => void forecastQuery.refetch()}
                />
              ) : (
                <p className="text-ui-xs text-text-secondary">
                  The ONNX forecast uses a different observation date or source and is not overlaid
                  on this history.
                </p>
              )}
            </div>
          </div>
        )}
      </InsightSection>

      <InsightSection title="Yield estimate" description="End of season, model estimate">
        <YieldEstimate
          prediction={yieldQuery.data}
          state={yieldQuery.status}
          simulated={provenance?.simulated ?? false}
          onRetry={() => void yieldQuery.refetch()}
        />
        <div className="mt-4">
          <RotationAdvisor
            fieldId={field.id}
            currentCrop={field.cropType}
            simulated={provenance?.simulated ?? false}
          />
        </div>
      </InsightSection>
    </div>
  );
}
