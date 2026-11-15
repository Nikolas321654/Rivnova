import { describe, expect, it } from 'vitest';
import { makeDashboard } from '@/entities/field/testing';
import { buildDecisionCards } from './decisions';

const base = makeDashboard();

describe('buildDecisionCards', () => {
  it('returns three independent assessments in a fixed order', () => {
    expect(buildDecisionCards(base, undefined, undefined).map((card) => card.id)).toEqual([
      'water',
      'workability',
      'vegetation',
    ]);
  });

  it('follows the backend irrigation evaluation and severity', () => {
    const [water] = buildDecisionCards(base, undefined, undefined);
    expect(water.status).toBe('Hidden stress');
    expect(water.tone).toBe('warning');
    expect(water.verdict).toBe('Irrigate 22.2 mm within 36h');
    expect(water.valueCaption).toBe('WDI, alert above 0.65');
  });

  it('does not recommend irrigation when the backend does not', () => {
    const dashboard = makeDashboard({
      stressAndIrrigation: {
        ...base.stressAndIrrigation,
        waterDeficitIndex: 0.51,
        irrigationRecommended: false,
        isHiddenStressDetected: false,
        severity: 'Info',
      },
    });
    const [water] = buildDecisionCards(dashboard, undefined, undefined);
    expect(water).toMatchObject({
      status: 'No water stress',
      tone: 'success',
      verdict: 'No irrigation needed now',
    });
  });

  it('keeps machinery and spraying separate and never calls workability crop health', () => {
    const dashboard = makeDashboard({
      workability: { ...base.workability, status: 'Optimal', sprayingSafe: false },
    });
    const [, workability] = buildDecisionCards(dashboard, undefined, undefined);
    expect(workability.verdict).toBe('Field operations are possible');
    expect(workability).toMatchObject({
      status: 'Spraying held back',
      tone: 'warning',
      value: 'Optimal',
      valueTone: 'success',
    });
    expect(workability.explanation).toContain('not crop health');
  });

  it('marks blocked workability as severe', () => {
    const dashboard = makeDashboard({
      workability: { ...base.workability, status: 'Blocked', sprayingSafe: false },
    });
    const [, workability] = buildDecisionCards(dashboard, undefined, undefined);
    expect(workability).toMatchObject({
      valueTone: 'danger',
      verdict: 'Keep machinery off the field',
    });
  });

  it('asks to scout an anomaly without naming a cause', () => {
    const dashboard = makeDashboard({
      biomass: { ...base.biomass, isAnomalyDetected: true, deltaPercent: -18.3, deltaNdvi: -0.13 },
    });
    const [, , vegetation] = buildDecisionCards(dashboard, undefined, undefined);
    expect(vegetation).toMatchObject({
      status: 'Decline detected',
      tone: 'warning',
      verdict: 'Scout the field',
    });
    expect(vegetation.explanation).not.toMatch(/pest|disease/i);
  });

  it('uses the stress endpoint threshold and crop target when available', () => {
    const [water] = buildDecisionCards(
      base,
      {
        fieldId: base.fieldId,
        waterDeficitIndex: 0.78,
        threshold: 0.7,
        rootzoneMoisture: 0.19,
        cropTargetMoisture: 0.55,
        evaporativeStressIndex: 0.32,
        ndviCurrent: 0.74,
        isHiddenStressDetected: true,
        irrigationRecommended: true,
        recommendedIrrigationMm: 22.2,
        recommendedWindowHours: 36,
        recommendation: 'Irrigate.',
      },
      undefined,
    );
    expect(water.valueCaption).toBe('WDI, alert above 0.70');
    expect(water.explanation).toContain('crop target of 0.55');
  });
});

it.each([null, undefined])('keeps omitted or null safety unknown: %s', (sprayingSafe) => {
  const dashboard = makeDashboard({
    workability: { ...base.workability, sprayingSafe, status: 'Unknown', rainLast12hMm: undefined },
  });
  const card = buildDecisionCards(JSON.parse(JSON.stringify(dashboard)), undefined, undefined)[1];
  expect(card.status).toBe('Check rain first');
  expect(card.tone).toBe('neutral');
  expect(card.value).toBe('Dry soil');
  expect(card.valueCaption).toBe('Machinery, from soil moisture');
  expect(card.verdict).toBe('Soil looks firm enough for machinery');
  expect(card.nextStep).toBe(
    'No heavy rain is forecast. Confirm the last 12h were dry before spraying.',
  );
  expect(card.explanation).toContain('uses surface moisture only');
  expect(card.explanation).not.toMatch(/NaN|undefined/);
});

it('gives every card one next step', () => {
  const cards = buildDecisionCards(makeDashboard(), undefined, undefined);
  cards.forEach((card) => expect(card.nextStep).toMatch(/^[A-Z].*\.$/));
});

it('labels modelled recent rain in the workability explanation', () => {
  const dashboard = makeDashboard({
    workability: {
      ...base.workability,
      rainLast12hMm: 0.4,
      recentRainSource: 'OPEN_METEO_FORECAST',
    },
  });
  const card = buildDecisionCards(dashboard, undefined, undefined)[1];
  expect(card.explanation).toContain('0.4 mm (Open-Meteo estimate)');
});
