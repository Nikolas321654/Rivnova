import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FieldSummary } from '@/entities/field';
import {
  describeCreateFieldError,
  validateFieldDraft,
  type FieldDraft,
  type FieldDraftErrors,
} from '@/features/create-field';
import { useUpdateField } from '@/features/edit-field';
import { buildFieldPatch, draftFromField, isFieldEditDirty } from './fieldEdit';

export function insightsPath(id: string): string {
  return `/fields/${encodeURIComponent(id)}`;
}

export function useEditFieldDraft(field: FieldSummary) {
  const navigate = useNavigate();
  const updateField = useUpdateField(field.id);
  const [draft, setDraft] = useState<FieldDraft>(() => draftFromField(field));
  const [showValidation, setShowValidation] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldDraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const dirty = isFieldEditDirty(field, draft);
  const errors: FieldDraftErrors = {
    ...(showValidation ? validateFieldDraft(draft) : {}),
    ...serverErrors,
    ...(mapError ? { boundary: mapError } : {}),
  };

  const updateDraft = (patch: Partial<FieldDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setServerErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof FieldDraftErrors];
      return next;
    });
    if ('boundary' in patch) setMapError(null);
    setSubmitError(null);
    setConfirmingDiscard(false);
  };

  const submit = () => {
    setShowValidation(true);
    setSubmitError(null);
    if (updateField.isPending) return;
    const { patch } = buildFieldPatch(field, draft);
    if (!patch) return;
    if (Object.keys(patch).length === 0) {
      navigate(insightsPath(field.id));
      return;
    }
    updateField.mutate(patch, {
      onSuccess: () => navigate(insightsPath(field.id), { state: { fieldUpdated: true } }),
      onError: (error) => {
        const failure = describeCreateFieldError(error);
        setServerErrors(failure.fieldErrors);
        setSubmitError(
          failure.sessionExpired
            ? 'Your session has expired. Sign in again, then save your changes.'
            : failure.message,
        );
      },
    });
  };

  const cancel = () => {
    if (dirty) setConfirmingDiscard(true);
    else navigate(insightsPath(field.id));
  };

  return {
    draft,
    errors,
    updateDraft,
    submit,
    cancel,
    saving: updateField.isPending,
    submitError,
    setMapError,
    confirmingDiscard,
    keepEditing: () => setConfirmingDiscard(false),
    discard: () => navigate(insightsPath(field.id)),
  };
}
