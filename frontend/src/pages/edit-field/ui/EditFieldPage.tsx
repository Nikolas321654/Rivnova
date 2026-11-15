import { faArrowLeft, faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, useParams } from 'react-router-dom';
import { isValidFieldId, useField, type FieldSummary } from '@/entities/field';
import { useCurrentUser } from '@/entities/user';
import { FieldDraftForm } from '@/features/create-field';
import { DrawFieldMap } from '@/features/draw-field';
import { GeoJsonImportButton } from '@/features/import-geojson';
import { ApiError } from '@/shared/api';
import { Button } from '@/shared/ui';
import { insightsPath, useEditFieldDraft } from '../model/useEditFieldDraft';

function EditFieldWorkspace({ field }: { field: FieldSummary }) {
  const flow = useEditFieldDraft(field);

  return (
    <div className="grid min-w-0 gap-3 p-3 sm:max-[1259px]:gap-4 sm:max-[1259px]:p-4 min-[1260px]:h-full min-[1260px]:grid-cols-[minmax(0,1fr)_360px] min-[1260px]:gap-0 min-[1260px]:p-0">
      <div className="flex min-w-0 flex-col gap-3 min-[1260px]:min-h-0 min-[1260px]:p-4">
        <div className="min-w-0">
          <h1 className="type-page-title">Edit field</h1>
          <p className="mt-1 text-ui-sm text-text-secondary">
            Adjust the boundary on the map or import a new GeoJSON file, then update the details.
          </p>
        </div>
        <div className="h-[56dvh] min-h-80 min-w-0 min-[1260px]:h-auto min-[1260px]:min-h-0 min-[1260px]:flex-1">
          <DrawFieldMap
            boundary={flow.draft.boundary}
            onBoundaryChange={(boundary) =>
              flow.updateDraft({ boundary, boundarySource: boundary ? { kind: 'drawn' } : null })
            }
            onBoundaryError={flow.setMapError}
          />
        </div>
      </div>

      <aside
        aria-label="Field configuration"
        className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-control border border-border bg-surface min-[1260px]:rounded-none min-[1260px]:border-y-0 min-[1260px]:border-r-0"
      >
        <FieldDraftForm
          title={field.name}
          submitLabel="Save changes"
          draft={flow.draft}
          errors={flow.errors}
          onChange={flow.updateDraft}
          onSubmit={flow.submit}
          onCancel={flow.cancel}
          saving={flow.saving}
          checkingSession={false}
          submitError={flow.submitError}
          boundaryActions={
            <GeoJsonImportButton
              disabled={flow.saving}
              onImport={(boundary, fileName) =>
                flow.updateDraft({ boundary, boundarySource: { kind: 'imported', fileName } })
              }
            />
          }
          footer={
            flow.confirmingDiscard ? (
              <div role="alert" className="grid gap-3">
                <p className="text-ui-sm text-text-primary">
                  Discard your changes? The field keeps its saved boundary and details.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={flow.keepEditing}>
                    Keep editing
                  </Button>
                  <Button
                    onClick={flow.discard}
                    className="border-status-danger bg-status-danger enabled:hover:border-status-danger enabled:hover:bg-status-danger/90"
                  >
                    Discard changes
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />
      </aside>
    </div>
  );
}

function EditUnavailable({
  title,
  message,
  fieldId,
}: {
  title: string;
  message: string;
  fieldId?: string;
}) {
  return (
    <div className="mx-auto grid max-w-lg gap-3 px-4 py-16 text-center">
      <FontAwesomeIcon
        icon={faLock}
        className="mx-auto text-ui-xl text-text-secondary"
        aria-hidden="true"
      />
      <h1 className="type-page-title">{title}</h1>
      <p className="text-ui-sm text-text-secondary">{message}</p>
      <Link
        to={fieldId ? insightsPath(fieldId) : '/'}
        className="mx-auto inline-flex items-center gap-1.5 text-ui-sm font-medium text-primary hover:underline"
      >
        <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
        {fieldId ? 'Back to field insights' : 'Back to Field Explorer'}
      </Link>
    </div>
  );
}

export function EditFieldPage() {
  const { id } = useParams();
  const session = useCurrentUser();
  const fieldQuery = useField(id);

  let content;
  if (!isValidFieldId(id)) {
    content = (
      <EditUnavailable title="Field not available" message="This field link is not valid." />
    );
  } else if (fieldQuery.isPending || session.isPending) {
    content = (
      <p role="status" className="py-16 text-center text-ui-sm text-text-secondary">
        Loading field…
      </p>
    );
  } else if (fieldQuery.isError) {
    const missing =
      fieldQuery.error instanceof ApiError &&
      (fieldQuery.error.kind === 'not-found' || fieldQuery.error.kind === 'unauthorized');
    content = missing ? (
      <EditUnavailable
        title="Field not available"
        message="This field does not exist or is not yours."
      />
    ) : (
      <div role="alert" className="py-16 text-center text-ui-sm text-text-secondary">
        <p>The field could not be loaded.</p>
        <Button variant="secondary" className="mt-3" onClick={() => void fieldQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  } else if (fieldQuery.data.isDemo) {
    content = (
      <EditUnavailable
        title="Demo fields are read-only"
        message="Shared demo fields cannot be changed. Add your own field to edit its boundary and details."
        fieldId={fieldQuery.data.id}
      />
    );
  } else if (session.data?.authenticated !== true) {
    content = (
      <EditUnavailable
        title="Sign in to edit"
        message="Sign in to the account that owns this field to change it."
        fieldId={fieldQuery.data.id}
      />
    );
  } else {
    content = <EditFieldWorkspace key={fieldQuery.data.id} field={fieldQuery.data} />;
  }

  return (
    <section
      aria-label="Edit field workspace"
      className="min-w-0 md:h-full md:overflow-y-auto min-[1260px]:overflow-hidden"
    >
      {content}
    </section>
  );
}
