import type { FieldSummary, UpdateFieldRequest } from '@/entities/field';
import {
  validateFieldDraft,
  type FieldDraft,
  type FieldDraftErrors,
} from '@/features/create-field';

export function draftFromField(field: FieldSummary): FieldDraft {
  return {
    name: field.name,
    cropType: field.cropType,
    plantedAt: field.plantedAt,
    boundary: field.boundary,
    boundarySource: { kind: 'drawn' },
  };
}

function sameBoundary(a: FieldDraft['boundary'], b: FieldDraft['boundary']): boolean {
  return JSON.stringify(a?.coordinates ?? null) === JSON.stringify(b?.coordinates ?? null);
}

export function buildFieldPatch(
  original: FieldSummary,
  draft: FieldDraft,
): { patch: UpdateFieldRequest | null; errors: FieldDraftErrors } {
  const errors = validateFieldDraft(draft);
  if (Object.keys(errors).length > 0 || !draft.cropType || !draft.boundary) {
    return { patch: null, errors };
  }
  const patch: UpdateFieldRequest = {};
  const name = draft.name.trim();
  if (name !== original.name) patch.name = name;
  if (draft.cropType !== original.cropType) patch.cropType = draft.cropType;
  if (draft.plantedAt !== original.plantedAt) patch.plantedAt = draft.plantedAt;
  if (!sameBoundary(draft.boundary, original.boundary)) patch.boundary = draft.boundary;
  return { patch, errors };
}

export function isFieldEditDirty(original: FieldSummary, draft: FieldDraft): boolean {
  return (
    draft.name.trim() !== original.name ||
    draft.cropType !== original.cropType ||
    draft.plantedAt !== original.plantedAt ||
    !sameBoundary(draft.boundary, original.boundary)
  );
}
