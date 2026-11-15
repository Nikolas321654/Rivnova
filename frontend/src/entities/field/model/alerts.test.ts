import { describe, expect, it } from 'vitest';
import { makeAlert, makeDashboard } from '../testing';
import { alertGroups, alertProvenance, alertToAction } from './alerts';

const demoId = '22222222-2222-2222-2222-222222222222';
const myId = '33333333-3333-3333-3333-333333333333';

describe('alertToAction', () => {
  it('keeps the field name apart from a short action line with the key number', () => {
    const action = alertToAction(makeAlert(), makeDashboard());
    expect(action).toMatchObject({
      fieldName: 'North Corn',
      title: 'Irrigate 22.2 mm within 36h',
      kind: 'irrigate',
    });
  });

  it('keeps the backend message unchanged apart from the field prefix', () => {
    const action = alertToAction(makeAlert());
    expect(action.recommendation).toBe('Recommended irrigation dose of 22.2 mm within 36 hours.');
  });

  it('marks the 72h model alert as a forecast', () => {
    const action = alertToAction(makeAlert({ alertType: 'Predictive72hStress' }));
    expect(action).toMatchObject({
      kind: 'forecast',
      title: 'Stress expected in 72h',
      predicted: true,
    });
  });

  it('uses the spraying decision for a blocked spraying alert', () => {
    const base = makeDashboard();
    const action = alertToAction(
      makeAlert({ alertType: 'SprayingBlocked' }),
      makeDashboard({
        workability: { ...base.workability, sprayingSafe: false, rainForecast24hMm: 6.8 },
      }),
    );
    expect(action).toMatchObject({ kind: 'spray', title: "Don't spray" });
  });

  it('keeps blocked machinery separate from spraying', () => {
    const base = makeDashboard();
    const dashboard = makeDashboard({
      workability: { ...base.workability, status: 'Blocked', sprayingSafe: false },
    });
    const spray = alertToAction(makeAlert({ id: 's', alertType: 'SprayingBlocked' }), dashboard);
    const machinery = alertToAction(
      makeAlert({ id: 'm', alertType: 'WorkabilityBlocked' }),
      dashboard,
    );
    expect(spray).toMatchObject({ kind: 'spray', title: "Don't spray" });
    expect(machinery).toMatchObject({ kind: 'machinery', title: 'Keep machinery off' });
  });

  it('falls back to a plain line without inventing numbers', () => {
    const action = alertToAction(makeAlert({ alertType: 'BiomassAnomaly' }));
    expect(action).toMatchObject({ title: 'Scout for NDVI drop', detail: '' });
  });
});

describe('alertGroups', () => {
  const alerts = [
    makeAlert({ id: 'c', fieldId: demoId, severity: 'Critical' }),
    makeAlert({ id: 'w', fieldId: myId, severity: 'Warning' }),
    makeAlert({ id: 'i', fieldId: demoId, severity: 'Info' }),
  ];

  it('keeps one group per field led by its most severe alert, in backend order', () => {
    const groups = alertGroups(alerts, [demoId, myId]);
    expect(groups.map((group) => [group.primary.id, group.others.map((a) => a.id)])).toEqual([
      ['c', ['i']],
      ['w', []],
    ]);
  });

  it('shows only alerts for the visible field group', () => {
    expect(alertGroups(alerts, [myId]).map((group) => group.primary.id)).toEqual(['w']);
    expect(alertGroups(alerts, [])).toEqual([]);
  });

  it('drops repeated alerts', () => {
    const [group] = alertGroups([...alerts, alerts[0]], [demoId]);
    expect(group.others).toHaveLength(1);
  });
});

describe('alertProvenance', () => {
  it('marks fixture alerts as sample data', () => {
    expect(alertProvenance(alertToAction(makeAlert()))).toEqual({
      sample: true,
      label: 'Sample data',
    });
  });

  it('describes live alerts as derived, not as direct NASA measurements', () => {
    const live = alertToAction(makeAlert({ dataSource: 'NASA_POWER_LIVE' }));
    expect(alertProvenance(live)?.label).toBe('Derived from live NASA POWER data');
    expect(alertProvenance(live)?.sample).toBe(false);
  });

  it('keeps model forecasts distinct from observations', () => {
    const forecast = alertToAction(
      makeAlert({ alertType: 'Predictive72hStress', dataSource: 'NASA_POWER_LIVE' }),
    );
    expect(alertProvenance(forecast)?.label).toBe('Model forecast from live NASA POWER inputs');
  });

  it('says nothing when the source is unknown', () => {
    expect(alertProvenance(alertToAction(makeAlert({ dataSource: undefined })))).toBeNull();
  });
});

describe('workabilityLabel', () => {
  it('names unknown workability as unconfirmed', async () => {
    const { workabilityLabel } = await import('./guidance');
    expect(workabilityLabel('Unknown')).toBe('Unconfirmed');
    expect(workabilityLabel('Marginal')).toBe('Marginal');
  });
});
