import { faDroplet, faHourglassHalf, faWater } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import {
  alertGroups,
  summarizeProvenance,
  useActiveAlerts,
  useFieldDashboards,
  useFieldSoilForecasts,
  useFieldWorkabilities,
  type FieldDashboard,
  type FieldGroup,
  type FieldSummary,
} from '@/entities/field';
import { Button, EmptyState, ParcelMotif } from '@/shared/ui';
import { actionView, type ActionView } from '../model/actionVisuals';
import { summarizeImpact } from '../model/overview';
import { AlertGroupRow } from './AlertGroupRow';
import { DataFreshnessFooter } from './DataFreshnessFooter';
import { ImpactRow } from './ImpactRow';
import { StatTile } from './StatTile';

type OverviewPanelProps = {
  fields: FieldSummary[];
  group: FieldGroup;
  loading: boolean;
  error: boolean;
  onSelectField: (id: string) => void;
};

const areaFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const largeAreaFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compactAreaFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatArea(hectares: number): string {
  if (hectares >= 100_000) return compactAreaFormatter.format(hectares);
  if (hectares >= 1_000) return largeAreaFormatter.format(hectares);
  return areaFormatter.format(hectares);
}
const visibleGroupLimit = 4;
const volumeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function OverviewPanel({
  fields,
  group,
  loading,
  error,
  onSelectField,
}: OverviewPanelProps) {
  const dashboardQueries = useFieldDashboards(fields.map((field) => field.id));
  const dashboards = dashboardQueries
    .map((query) => query.data)
    .filter((data): data is FieldDashboard => data !== undefined);
  const pendingCount = dashboardQueries.filter((query) => query.isPending).length;
  const failedQueries = dashboardQueries.filter((query) => query.isError);
  const alertsQuery = useActiveAlerts();
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const groups = alertGroups(
    alertsQuery.data ?? [],
    fields.map((field) => field.id),
    dashboards,
  );
  const alertFieldIds = groups.map((group) => group.fieldId);
  const forecastQueries = useFieldSoilForecasts(alertFieldIds);
  const workabilityQueries = useFieldWorkabilities(alertFieldIds);
  const views = new Map<string, ActionView>();
  groups.forEach((group, index) => {
    const context = {
      dashboard: dashboards.find((dashboard) => dashboard.fieldId === group.fieldId),
      forecast: forecastQueries[index]?.data,
      workability: workabilityQueries[index]?.data,
    };
    for (const action of [group.primary, ...group.others]) {
      views.set(action.id, actionView(action, context));
    }
  });
  const alertCount = groups.reduce((sum, group) => sum + 1 + group.others.length, 0);
  const visibleGroups = showAll ? groups : groups.slice(0, visibleGroupLimit);
  const alertsReady = !loading && !error && alertsQuery.isSuccess;

  const impact = summarizeImpact(dashboards);
  const totalArea = fields.reduce((sum, field) => sum + field.areaHectares, 0);
  const blockedCount = fields.filter((field) => field.workabilityStatus === 'Blocked').length;
  const unavailable = loading ? '…' : error ? 'n/a' : null;

  return (
    <>
      <div className="relative shrink-0 border-b border-border/70 px-5 pb-5 pt-5">
        <ParcelMotif />
        <div className="relative pr-10">
          <h2 className="type-page-title">Current conditions</h2>
          <p className="mt-0.5 type-label">{group === 'mine' ? 'My fields' : 'Demo fields'}</p>
        </div>
        <dl className="relative mt-4 grid grid-cols-2 gap-2">
          <StatTile label="Fields" value={unavailable ?? String(fields.length)} />
          <StatTile
            label="Total area"
            value={unavailable ?? formatArea(totalArea)}
            unit={unavailable ? undefined : 'ha'}
            fullValue={unavailable ? undefined : `${areaFormatter.format(totalArea)} ha`}
          />
          <StatTile
            label="Blocked"
            value={unavailable ?? String(blockedCount)}
            tone={!unavailable && blockedCount > 0 ? 'danger' : 'default'}
          />
          <StatTile
            label="Active alerts"
            value={
              unavailable ?? (alertsQuery.isError ? 'n/a' : alertsReady ? String(alertCount) : '…')
            }
            tone={alertsReady && alertCount > 0 ? 'warning' : 'default'}
          />
        </dl>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-5"
        aria-live="polite"
      >
        <section aria-labelledby="today-actions-title">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="today-actions-title" className="type-section-title">
              Today's actions
            </h3>
            {alertsReady && groups.length > 0 && (
              <span className="text-ui-xs text-text-secondary">Most urgent first</span>
            )}
          </div>
          {(loading || (!error && alertsQuery.isPending)) && (
            <p role="status" className="mt-3 text-ui-sm text-text-secondary">
              Checking field alerts…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-ui-sm text-text-secondary">
              Field status unavailable.
            </p>
          )}
          {!loading && !error && alertsQuery.isError && (
            <div role="alert" className="mt-3 text-ui-sm text-text-secondary">
              <p>Field alerts unavailable.</p>
              <Button
                variant="secondary"
                className="mt-2"
                disabled={alertsQuery.isFetching}
                onClick={() => void alertsQuery.refetch()}
              >
                Retry alerts
              </Button>
            </div>
          )}
          {alertsReady && groups.length === 0 && (
            <EmptyState
              className="mt-2"
              {...(fields.length === 0
                ? group === 'mine'
                  ? {
                      stickers: ['tractor'] as const,
                      title: 'No fields to watch yet',
                      text: 'Add a field and its conditions and actions will show up here.',
                    }
                  : {
                      stickers: ['satellite'] as const,
                      title: 'No demo fields yet',
                      text: 'Sample fields will appear here once they are available.',
                    }
                : {
                    stickers: ['sunnyCloud'] as const,
                    title: 'All clear',
                    text: 'No active alerts. Some conditions may still be unavailable.',
                  })}
            />
          )}
          {alertsReady && groups.length > 0 && (
            <ul className="-mx-3 mt-2">
              {visibleGroups.map((group) => (
                <li key={group.fieldId}>
                  <AlertGroupRow
                    group={group}
                    views={views}
                    expanded={expandedField === group.fieldId}
                    onToggle={() =>
                      setExpandedField((current) =>
                        current === group.fieldId ? null : group.fieldId,
                      )
                    }
                    onSelect={onSelectField}
                  />
                </li>
              ))}
            </ul>
          )}
          {alertsReady && groups.length > visibleGroupLimit && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className="mt-1.5 rounded-control text-ui-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {showAll ? 'Show fewer' : `Show all ${groups.length} fields`}
            </button>
          )}
        </section>

        {pendingCount > 0 && dashboards.length > 0 && (
          <p role="status" className="mt-5 text-ui-xs text-text-secondary">
            Checking {pendingCount} more {pendingCount === 1 ? 'field' : 'fields'}…
          </p>
        )}
        {failedQueries.length > 0 && (
          <div role="alert" className="mt-5 text-ui-xs text-text-secondary">
            <p>
              Analytics unavailable for {failedQueries.length}{' '}
              {failedQueries.length === 1 ? 'field' : 'fields'}.
            </p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => failedQueries.forEach((query) => void query.refetch())}
            >
              Retry analytics
            </Button>
          </div>
        )}

        {impact && (
          <section aria-labelledby="impact-title" className="mt-7">
            <h3 id="impact-title" className="type-section-title">
              Impact estimate
            </h3>
            <dl className="mt-2 space-y-2.5">
              <ImpactRow
                icon={faDroplet}
                label="Water saved"
                value={`${volumeFormatter.format(impact.waterSavedM3PerHa)} m³/ha`}
                hint={`≈ ${volumeFormatter.format(impact.waterSavedM3)} m³ across ${dashboards.length} ${dashboards.length === 1 ? 'field' : 'fields'}`}
              />
              <ImpactRow
                icon={faHourglassHalf}
                label="Early warning lead time"
                value={
                  impact.maxLeadTimeDays > 0
                    ? `${impact.maxLeadTimeDays} ${impact.maxLeadTimeDays === 1 ? 'day' : 'days'}`
                    : 'None'
                }
                hint={
                  impact.maxLeadTimeDays > 0
                    ? 'Before visible wilting'
                    : 'No hidden stress detected'
                }
              />
              <ImpactRow
                icon={faWater}
                label="Runoff risk prevented"
                value={`${impact.runoffPreventedFields} of ${dashboards.length}`}
                hint="Fields with spraying held back"
              />
            </dl>
          </section>
        )}
      </div>

      {fields.length > 0 && (
        <DataFreshnessFooter
          provenance={dashboards.length > 0 ? summarizeProvenance(dashboards) : null}
        />
      )}
    </>
  );
}
