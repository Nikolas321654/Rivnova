import { describe, expect, it } from 'vitest';
import { makeFieldSummary } from '@/entities/field/testing';
import { buildFieldPatch, draftFromField, isFieldEditDirty } from './fieldEdit';

const field = makeFieldSummary({ isDemo: false, name: 'Home Wheat', cropType: 'Wheat' });

describe('buildFieldPatch', () => {
  it('sends only the changed properties', () => {
    const draft = { ...draftFromField(field), name: '  River Plot  ', cropType: 'Corn' as const };
    expect(buildFieldPatch(field, draft).patch).toEqual({ name: 'River Plot', cropType: 'Corn' });
  });

  it('includes a changed boundary', () => {
    const boundary = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [30.5, 49.2],
          [30.52, 49.2],
          [30.52, 49.215],
          [30.5, 49.215],
          [30.5, 49.2],
        ] as [number, number][],
      ],
    };
    const { patch } = buildFieldPatch(field, { ...draftFromField(field), boundary });
    expect(patch).toEqual({ boundary });
  });

  it('returns an empty patch when nothing changed', () => {
    expect(buildFieldPatch(field, draftFromField(field)).patch).toEqual({});
    expect(isFieldEditDirty(field, draftFromField(field))).toBe(false);
  });

  it('refuses invalid drafts', () => {
    const { patch, errors } = buildFieldPatch(field, { ...draftFromField(field), name: ' ' });
    expect(patch).toBeNull();
    expect(errors.name).toBe('Enter a field name.');
  });
});
