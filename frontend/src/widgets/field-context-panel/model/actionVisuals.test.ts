import { describe, expect, it } from 'vitest';
import { alertToAction } from '@/entities/field';
import {
  makeAlert,
  makeDashboard,
  makeSoilForecast,
  makeWorkabilityWindow,
} from '@/entities/field/testing';
import { WATER_DEFICIT_ALERT_THRESHOLD } from '@/shared/config/thresholds';
import { actionView } from './actionVisuals';

const dashboard = makeDashboard();

describe('actionView', () => {
  it('shows irrigation as a WDI meter against the shared threshold', () => {
    const view = actionView(alertToAction(makeAlert(), dashboard), { dashboard });
    expect(view.visual).toMatchObject({
      type: 'meter',
      value: 0.78,
      threshold: WATER_DEFICIT_ALERT_THRESHOLD,
    });
    expect(view.facts.map((fact) => [fact.label, fact.value])).toEqual([
      ['WDI now', '0.78'],
      ['Dose', '22.2 mm'],
      ['Act within', '36h'],
    ]);
  });

  it('shows the forecast as a WDI trend from now through the model days', () => {
    const forecast = makeSoilForecast();
    const view = actionView(alertToAction(makeAlert({ alertType: 'Predictive72hStress' })), {
      dashboard,
      forecast,
    });
    expect(view.visual).toMatchObject({ type: 'trend', threshold: 0.65 });
    expect(view.visual?.type === 'trend' && view.visual.values).toHaveLength(8);
    expect(view.facts.map((fact) => fact.label)).toEqual(['WDI now', 'WDI in 72h', 'Alert above']);
  });

  it('shows workability as today, 24h and 48h statuses', () => {
    const view = actionView(alertToAction(makeAlert({ alertType: 'WorkabilityMarginal' })), {
      dashboard,
      workability: makeWorkabilityWindow(),
    });
    expect(view.visual).toMatchObject({
      type: 'periods',
      periods: [
        { label: 'Today', status: 'Optimal' },
        { label: '24h', status: 'Optimal' },
        { label: '48h', status: 'Marginal' },
      ],
    });
  });

  it('shows the NDVI change for scouting', () => {
    const scoutDashboard = makeDashboard({
      biomass: { ...dashboard.biomass, deltaPercent: -18.3, isAnomalyDetected: true },
    });
    const view = actionView(alertToAction(makeAlert({ alertType: 'BiomassAnomaly' })), {
      dashboard: scoutDashboard,
    });
    expect(view.visual).toMatchObject({ type: 'change', percent: -18.3 });
    expect(view.facts.at(-1)).toEqual({ label: 'Change', value: '-18%' });
  });

  it('shows no visual or values without backend data', () => {
    expect(actionView(alertToAction(makeAlert()), {})).toEqual({ visual: null, facts: [] });
  });
});
