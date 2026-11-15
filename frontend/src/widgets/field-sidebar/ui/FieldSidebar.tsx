import { useState } from 'react';
import { DeleteFieldDialog } from '@/features/delete-field';
import { faDrawPolygon, faPen, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, useNavigate } from 'react-router-dom';
import { FieldCard, fieldsInGroup, visibleFieldGroup, type FieldSummary } from '@/entities/field';
import { polygonPositions } from '@/shared/lib/geo';
import { emptyFieldDraft, saveStoredDraft } from '@/features/create-field';
import { GeoJsonImportButton } from '@/features/import-geojson';
import { Button, EmptyState } from '@/shared/ui';

type FieldSidebarProps = {
  fields: FieldSummary[];
  selectedFieldId: string | null;
  hoveredFieldId: string | null;
  onSelectField: (id: string) => void;
  onHoverField: (id: string | null) => void;
  activeTab: 'demo' | 'mine';
  onTabChange: (tab: 'demo' | 'mine') => void;
  authenticated: boolean;
  loading: boolean;
  error: boolean;
  onRetryFields: () => void;
  cardMode?: 'select' | 'open';
};

export function FieldSidebar({
  fields,
  selectedFieldId,
  hoveredFieldId,
  onSelectField,
  onHoverField,
  activeTab,
  onTabChange,
  authenticated,
  loading,
  error,
  onRetryFields,
  cardMode = 'select',
}: FieldSidebarProps) {
  const navigate = useNavigate();
  const [deletingField, setDeletingField] = useState<FieldSummary | null>(null);
  const shownFields = fieldsInGroup(fields, visibleFieldGroup(activeTab, authenticated));

  return (
    <div className="mt-2 min-w-0">
      {authenticated && (
        <div
          role="tablist"
          aria-label="Field groups"
          className="mb-3 flex gap-1 rounded-control bg-surface-muted p-1"
        >
          {(['demo', 'mine'] as const).map((tab) => (
            <button
              key={tab}
              id={`${tab}-fields-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls="field-group-panel"
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => onTabChange(tab)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const nextTab = tab === 'demo' ? 'mine' : 'demo';
                onTabChange(nextTab);
                document.getElementById(`${nextTab}-fields-tab`)?.focus();
              }}
              className={`min-h-11 min-w-0 flex-1 rounded-control px-2 text-ui-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${activeTab === tab ? 'bg-selection text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {tab === 'demo' ? 'Demo Fields' : 'My Fields'}
            </button>
          ))}
        </div>
      )}
      {!authenticated && <p className="mb-3 type-label">Demo Fields</p>}
      <div
        id={authenticated ? 'field-group-panel' : undefined}
        role={authenticated ? 'tabpanel' : undefined}
        aria-labelledby={authenticated ? `${activeTab}-fields-tab` : undefined}
      >
        {loading && (
          <p role="status" className="text-ui-sm text-text-secondary">
            Loading fields…
          </p>
        )}
        {error && (
          <div role="alert" className="text-ui-sm text-text-secondary">
            <p>Unable to load fields.</p>
            <Button variant="secondary" onClick={onRetryFields} className="mt-2">
              Retry
            </Button>
          </div>
        )}
        {!loading &&
          !error &&
          shownFields.length === 0 &&
          (authenticated && activeTab === 'mine' ? (
            <EmptyState
              stickers={['landscape', 'seedling']}
              title="Start your first field"
              text="Outline it on the map or bring a boundary file, and Rivnova starts watching it."
              actions={
                <>
                  <Link
                    to="/fields/new?draw=true"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-primary bg-primary px-control-x text-ui-sm font-semibold text-surface! transition-colors hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <FontAwesomeIcon icon={faDrawPolygon} aria-hidden="true" />
                    Draw on the map
                  </Link>
                  <GeoJsonImportButton
                    onImport={(boundary, fileName) => {
                      saveStoredDraft({
                        ...emptyFieldDraft,
                        boundary,
                        boundarySource: { kind: 'imported', fileName },
                      });
                      navigate('/fields/new');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onTabChange('demo')}
                    className="mt-1 self-center rounded-control text-ui-xs font-medium text-text-secondary hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Or explore the demo fields
                  </button>
                </>
              }
            />
          ) : (
            <EmptyState
              stickers={['satellite']}
              title="No demo fields yet"
              text="Sample fields will appear here once they are available."
            />
          ))}
        {!loading && !error && (
          <ul className="space-y-1.5">
            {shownFields.map((field) => (
              <li key={field.id}>
                <FieldCard
                  field={field}
                  selected={field.id === selectedFieldId}
                  hovered={field.id === hoveredFieldId}
                  selectable={polygonPositions(field.boundary) !== null}
                  onSelect={onSelectField}
                  onHover={onHoverField}
                  mode={cardMode}
                  actions={
                    authenticated && activeTab === 'mine' && !field.isDemo ? (
                      <>
                        <Link
                          to={`/fields/${encodeURIComponent(field.id)}/edit`}
                          aria-label={`Edit ${field.name}`}
                          title="Edit field"
                          className="inline-flex size-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeletingField(field)}
                          aria-label={`Delete ${field.name}`}
                          title="Delete field"
                          className="inline-flex size-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted hover:text-status-danger focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                        </button>
                      </>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {deletingField && (
        <DeleteFieldDialog
          field={deletingField}
          onClose={() => setDeletingField(null)}
          onDeleted={() => {
            setDeletingField(null);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}
