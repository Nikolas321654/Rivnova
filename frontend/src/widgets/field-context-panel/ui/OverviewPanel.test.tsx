import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldGroup, FieldSummary } from '@/entities/field';
import {
  demoFieldId,
  makeAlert,
  makeDashboard,
  makeFieldSummary,
  makeSoilForecast,
  makeWorkabilityWindow,
} from '@/entities/field/testing';
import type * as SharedApi from '@/shared/api';
import { ApiError, apiRequest } from '@/shared/api';
import { OverviewPanel } from './OverviewPanel';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

const request = vi.mocked(apiRequest);

const myFieldId = '33333333-3333-3333-3333-333333333333';
const demoField = makeFieldSummary();
const myField = makeFieldSummary({
  id: myFieldId,
  name: 'Home Wheat',
  cropType: 'Wheat',
  isDemo: false,
});

const alerts = [
  makeAlert({
    id: 'predicted',
    alertType: 'Predictive72hStress',
    severity: 'Critical',
    title: '72h Proactive Water Stress Forecast',
    message: `${demoField.name}: AI forecast projects rootzone moisture dropping to 0.31 in 72 hours (WDI 0.80). Schedule preventive irrigation within 48 hours.`,
  }),
  makeAlert({ id: 'observed', severity: 'Warning' }),
  makeAlert({
    id: 'mine',
    fieldId: myFieldId,
    fieldName: myField.name,
    alertType: 'WorkabilityMarginal',
    severity: 'Info',
    title: 'Marginal Field Workability Window',
    message: `${myField.name}: Light machinery only.`,
  }),
];

function respond(alertsResponse: unknown | (() => unknown)) {
  request.mockImplementation(async (path: string) => {
    if (path === '/alerts') {
      const value = typeof alertsResponse === 'function' ? alertsResponse() : alertsResponse;
      if (value instanceof Error) throw value;
      return value as never;
    }
    const id = path.split('/')[2];
    if (path.endsWith('/dashboard')) return makeDashboard({ fieldId: id }) as never;
    if (path.endsWith('/predictions/soil-forecast'))
      return makeSoilForecast({ fieldId: id, forecastedDay3WaterDeficitIndex: 0.8 }) as never;
    if (path.endsWith('/workability'))
      return makeWorkabilityWindow({
        fieldId: id,
        forecast48h: [
          { period: 'Today', status: 'Marginal', reason: '' },
          { period: 'Next 24h', status: 'Optimal', reason: '' },
          { period: '24h-48h', status: 'Blocked', reason: '' },
        ],
      }) as never;
    throw new ApiError('not-found', 404, 'Not Found');
  });
}

function renderPanel(fields: FieldSummary[], group: FieldGroup = 'demo') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelectField = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <OverviewPanel
        fields={fields}
        group={group}
        loading={false}
        error={false}
        onSelectField={onSelectField}
      />
    </QueryClientProvider>,
  );
  const rerender = (nextFields: FieldSummary[], nextGroup: FieldGroup) =>
    view.rerender(
      <QueryClientProvider client={client}>
        <OverviewPanel
          fields={nextFields}
          group={nextGroup}
          loading={false}
          error={false}
          onSelectField={onSelectField}
        />
      </QueryClientProvider>,
    );
  return { onSelectField, rerender };
}

function selectButtons() {
  return within(screen.getByRole('region', { name: "Today's actions" }))
    .queryAllByRole('button')
    .filter((button) => !button.hasAttribute('aria-expanded'));
}

function alertCount() {
  return screen.getByText('Active alerts').parentElement?.textContent ?? '';
}

beforeEach(() => {
  request.mockReset();
});

describe('OverviewPanel alerts', () => {
  async function rows(count: number) {
    return waitFor(() => {
      const found = selectButtons();
      expect(found).toHaveLength(count);
      return found;
    });
  }

  it('leads each row with the field name and a short action line', async () => {
    respond(alerts);
    renderPanel([demoField]);

    const [row] = await rows(1);
    expect(within(row).getByText('North Corn')).toBeTruthy();
    expect(within(row).getByText('Stress expected in 72h')).toBeTruthy();
    expect(screen.queryByText(/AI forecast projects/)).toBeNull();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(alertCount()).toContain('2');
  });

  it('puts severity in the accessible name instead of visible text', async () => {
    respond(alerts);
    renderPanel([demoField]);

    const [row] = await rows(1);
    expect(within(row).getByText(/^Critical:/).className).toContain('sr-only');
  });

  it('shows a small forecast trend in the row once the forecast loads', async () => {
    respond(alerts);
    renderPanel([demoField]);

    await rows(1);
    await waitFor(() =>
      expect(document.querySelector('[title^="Forecast water deficit index"]')).toBeTruthy(),
    );
  });

  it('expands into key values and a chart, with the backend message in a popover', async () => {
    respond(alerts);
    const { onSelectField } = renderPanel([demoField]);

    fireEvent.click(await screen.findByRole('button', { name: 'Show 2 alerts for North Corn' }));
    await waitFor(() => expect(screen.getByText('WDI in 72h')).toBeTruthy());
    expect(screen.getByText('0.80')).toBeTruthy();
    expect(screen.getByText('Act within')).toBeTruthy();
    expect(screen.getByText('36h')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Forecast water deficit index/ })).toBeTruthy();
    expect(screen.queryByText(/AI forecast projects/)).toBeNull();
    expect(screen.queryByText(/It may not happen/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'About Stress expected in 72h' }));
    expect(screen.getByRole('tooltip').textContent).toMatch(
      /AI forecast projects rootzone moisture dropping to 0.31.*It may not happen\./,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open North Corn/ }));
    expect(onSelectField).toHaveBeenCalledWith(demoFieldId);
  });

  it('shows workability for today, 24h and 48h as colored dots', async () => {
    respond(alerts);
    renderPanel([myField], 'mine');

    const [row] = await rows(1);
    expect(within(row).getByText('Home Wheat')).toBeTruthy();
    expect(within(row).getByText('Light machinery only')).toBeTruthy();
    await waitFor(() =>
      expect(
        document.querySelector('[title="Workability Today Marginal, 24h Optimal, 48h Blocked"]'),
      ).toBeTruthy(),
    );
  });

  it('marks sample-data alerts subtly and names the source in the details', async () => {
    respond([
      makeAlert({
        id: 'live',
        fieldId: myFieldId,
        fieldName: myField.name,
        alertType: 'BiomassAnomaly',
        dataSource: 'NASA_POWER_LIVE',
      }),
      ...alerts,
    ]);
    renderPanel([demoField, myField]);

    const [liveRow, demoRow] = await rows(2);
    expect(within(demoRow).getByText(', sample data')).toBeTruthy();
    expect(within(liveRow).queryByText(', sample data')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 alerts for Home Wheat' }));
    expect(screen.getByText('Derived from live NASA POWER data')).toBeTruthy();
  });

  it('shows only alerts for the visible field group', async () => {
    respond(alerts);
    const { rerender } = renderPanel([demoField], 'demo');
    await rows(1);

    rerender([myField], 'mine');
    await waitFor(() => expect(screen.getByText('Home Wheat')).toBeTruthy());
    expect(screen.queryByText('North Corn')).toBeNull();
    expect(alertCount()).toContain('1');
  });

  it('does not show the same alert twice', async () => {
    respond([...alerts, alerts[1]]);
    renderPanel([demoField]);
    await waitFor(() => expect(alertCount()).toContain('2'));
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('selects the alert field', async () => {
    respond(alerts);
    const { onSelectField } = renderPanel([demoField]);

    fireEvent.click((await rows(1))[0]);
    expect(onSelectField).toHaveBeenCalledWith(demoFieldId);
  });

  it('shows the top rows first and the rest on demand', async () => {
    const extraFields = Array.from({ length: 5 }, (_, index) =>
      makeFieldSummary({
        id: `5555555${index}-5555-5555-5555-555555555555`,
        name: `Plot ${index + 1}`,
      }),
    );
    respond(
      extraFields.map((field, index) =>
        makeAlert({
          id: `extra-${index}`,
          fieldId: field.id,
          fieldName: field.name,
          alertType: 'BiomassAnomaly',
          message: `${field.name}: Scout.`,
        }),
      ),
    );
    renderPanel(extraFields);

    await rows(4);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 5 fields' }));
    expect(selectButtons()).toHaveLength(5);
  });

  it('does not show zero alerts while loading', async () => {
    request.mockImplementation((path: string) =>
      path === '/alerts' ? new Promise(() => {}) : Promise.resolve(makeDashboard() as never),
    );
    renderPanel([demoField]);

    expect(screen.getByText('Checking field alerts…')).toBeTruthy();
    expect(alertCount()).toContain('…');
    expect(alertCount()).not.toContain('0');
  });

  it('shows the empty state when no alerts apply', async () => {
    respond([]);
    renderPanel([demoField]);

    expect(
      await screen.findByText('No active alerts. Some conditions may still be unavailable.'),
    ).toBeTruthy();
    expect(alertCount()).toContain('0');
  });

  it('shows a failure with retry and recovers', async () => {
    let fail = true;
    respond(() => (fail ? new ApiError('server', 500, 'Server Error') : alerts));
    renderPanel([demoField]);

    expect(await screen.findByText('Field alerts unavailable.')).toBeTruthy();
    expect(alertCount()).toContain('n/a');

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry alerts' }));
    expect(await screen.findByText('Stress expected in 72h')).toBeTruthy();
    expect(screen.queryByText('Field alerts unavailable.')).toBeNull();
  });
});
