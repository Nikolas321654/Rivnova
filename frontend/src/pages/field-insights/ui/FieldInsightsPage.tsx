import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFields } from '@/entities/field';
import { useCurrentUser } from '@/entities/user';
import { AppShell } from '@/widgets/app-shell';
import { FieldInsights, parseHistoryDays, type HistoryDays } from '@/widgets/field-insights';
import { FieldSidebar } from '@/widgets/field-sidebar';

export function FieldInsightsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldsQuery = useFields();
  const userQuery = useCurrentUser();
  const [chosenTab, setChosenTab] = useState<'demo' | 'mine' | null>(null);
  const days = parseHistoryDays(searchParams.get('days'));
  const fields = fieldsQuery.data ?? [];
  const currentField = fields.find((field) => field.id === id);
  const activeTab = chosenTab ?? (currentField && !currentField.isDemo ? 'mine' : 'demo');

  const changeDays = (next: HistoryDays) =>
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        updated.set('days', String(next));
        return updated;
      },
      { replace: true },
    );

  const openField = (fieldId: string) => {
    if (fieldId === id) return;
    navigate(`/fields/${encodeURIComponent(fieldId)}${days === null ? '' : `?days=${days}`}`);
  };

  return (
    <AppShell
      panelContent={
        <FieldSidebar
          fields={fields}
          selectedFieldId={currentField?.id ?? null}
          hoveredFieldId={null}
          onSelectField={openField}
          onHoverField={() => undefined}
          activeTab={activeTab}
          onTabChange={setChosenTab}
          authenticated={userQuery.data?.authenticated === true}
          loading={fieldsQuery.isPending}
          error={fieldsQuery.isError}
          onRetryFields={() => void fieldsQuery.refetch()}
          cardMode="open"
        />
      }
    >
      <section aria-label="Field Insights workspace" className="h-full min-w-0 md:overflow-y-auto">
        <FieldInsights key={id} fieldId={id} days={days} onDaysChange={changeDays} />
      </section>
    </AppShell>
  );
}
