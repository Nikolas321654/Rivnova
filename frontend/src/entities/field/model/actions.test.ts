import { describe, expect, it } from 'vitest';
import { makeDashboard } from '../testing';
import type { WorkabilityStatus } from './types';
import { buildFieldActions, fieldMessage, sortActions } from './actions';

describe('buildFieldActions', () => {
  it('keeps water stress and workability as separate actions', () => {
    const dashboard = makeDashboard({
      workability: {
        ...makeDashboard().workability,
        status: 'Blocked',
        sprayingSafe: false,
        rainForecast24hMm: 6.8,
      },
    });
    const kinds = buildFieldActions(dashboard).map((action) => action.kind);
    expect(kinds).toEqual(['irrigate', 'spray', 'machinery']);
  });

  describe('spraying and machinery are independent decisions', () => {
    const base = makeDashboard();
    const kindsFor = (status: WorkabilityStatus, sprayingSafe: boolean) =>
      buildFieldActions(
        makeDashboard({
          stressAndIrrigation: { ...base.stressAndIrrigation, irrigationRecommended: false },
          workability: { ...base.workability, status, sprayingSafe },
        }),
      ).map((action) => action.kind);

    it('Blocked and unsafe to spray gives both warnings', () => {
      expect(kindsFor('Blocked', false)).toEqual(['spray', 'machinery']);
    });

    it('Marginal and unsafe to spray gives both warnings', () => {
      expect(kindsFor('Marginal', false)).toEqual(['spray', 'machinery']);
    });

    it('Optimal and unsafe to spray gives the spraying warning only', () => {
      expect(kindsFor('Optimal', false)).toEqual(['spray']);
    });

    it('Blocked and safe to spray gives the machinery warning only', () => {
      expect(kindsFor('Blocked', true)).toEqual(['machinery']);
    });

    it('does not warn about spraying when its safety is unknown', () => {
      expect(
        buildFieldActions(
          makeDashboard({
            stressAndIrrigation: { ...base.stressAndIrrigation, irrigationRecommended: false },
            workability: {
              ...base.workability,
              sprayingSafe: null,
              rainForecast24hMm: null,
              rainForecast24To48hMm: null,
              forecastSource: null,
            },
          }),
        ),
      ).toEqual([]);
    });

    it('turns unknown workability into a calm field check, never a permission to work', () => {
      const [action] = buildFieldActions(
        makeDashboard({
          stressAndIrrigation: { ...base.stressAndIrrigation, irrigationRecommended: false },
          workability: {
            ...base.workability,
            status: 'Unknown',
            sprayingSafe: true,
            surfaceMoisture: 0.21,
            rainForecast24hMm: 0.4,
          },
        }),
      );
      expect(action).toMatchObject({
        kind: 'machinery',
        severity: 'Info',
        title: 'Check North Corn before heavy machinery',
        detail: 'Dry soil, recent rain unknown',
      });
      expect(action.recommendation).toContain('Machinery safety unconfirmed');
      expect(action.recommendation).toContain('Check the topsoil on site');
      expect(action.recommendation).toContain('Next 24h: 0.4 mm rain forecast.');
      expect(action.title).not.toMatch(/Light machinery/);
    });

    it('Optimal and safe to spray gives neither warning', () => {
      expect(kindsFor('Optimal', true)).toEqual([]);
    });

    it('keeps the machinery wording and severity from the workability status', () => {
      const [blocked] = buildFieldActions(
        makeDashboard({
          stressAndIrrigation: { ...base.stressAndIrrigation, irrigationRecommended: false },
          workability: { ...base.workability, status: 'Blocked', sprayingSafe: false },
        }),
      ).filter((action) => action.kind === 'machinery');
      expect(blocked.title).toBe('Keep machinery off North Corn');
      expect(blocked.severity).toBe('Warning');

      const [marginal] = buildFieldActions(
        makeDashboard({
          stressAndIrrigation: { ...base.stressAndIrrigation, irrigationRecommended: false },
          workability: { ...base.workability, status: 'Marginal', sprayingSafe: false },
        }),
      ).filter((action) => action.kind === 'machinery');
      expect(marginal.title).toBe('Light machinery only on North Corn');
      expect(marginal.severity).toBe('Info');
    });

    it('gives each action a stable, unique id', () => {
      const ids = buildFieldActions(
        makeDashboard({
          workability: { ...base.workability, status: 'Blocked', sprayingSafe: false },
        }),
      ).map((action) => action.id);
      expect(ids).toEqual([
        `${base.fieldId}:irrigate`,
        `${base.fieldId}:spray`,
        `${base.fieldId}:machinery`,
      ]);
    });
  });

  it('does not create an irrigation action when the backend does not recommend it', () => {
    const base = makeDashboard();
    const dashboard = makeDashboard({
      stressAndIrrigation: {
        ...base.stressAndIrrigation,
        irrigationRecommended: false,
        isHiddenStressDetected: false,
      },
    });
    expect(buildFieldActions(dashboard)).toEqual([]);
  });

  it('asks to scout a biomass anomaly without naming a cause', () => {
    const base = makeDashboard();
    const dashboard = makeDashboard({
      stressAndIrrigation: { ...base.stressAndIrrigation, irrigationRecommended: false },
      biomass: { ...base.biomass, isAnomalyDetected: true, deltaPercent: -18.3 },
    });
    const [action] = buildFieldActions(dashboard);
    expect(action.kind).toBe('scout');
    expect(action.title).toBe('Scout North Corn');
    expect(action.detail).toBe('NDVI down 18%, soil moisture OK');
  });

  it('uses the backend severity for irrigation', () => {
    const base = makeDashboard();
    const dashboard = makeDashboard({
      stressAndIrrigation: { ...base.stressAndIrrigation, severity: 'Critical' },
    });
    expect(buildFieldActions(dashboard)[0].severity).toBe('Critical');
  });
});

describe('sortActions', () => {
  it('orders Critical, then Warning, then Info', () => {
    const base = makeDashboard();
    const dashboard = makeDashboard({
      stressAndIrrigation: { ...base.stressAndIrrigation, severity: 'Info' },
      workability: { ...base.workability, status: 'Blocked', sprayingSafe: false },
    });
    expect(sortActions(buildFieldActions(dashboard)).map((action) => action.kind)).toEqual([
      'spray',
      'machinery',
      'irrigate',
    ]);
  });
});

describe('fieldMessage', () => {
  const fieldName = makeDashboard().fieldName;

  it('removes the field name prefix the backend adds', () => {
    expect(fieldMessage(`${fieldName}: Irrigate now.`, fieldName)).toBe('Irrigate now.');
  });
});
