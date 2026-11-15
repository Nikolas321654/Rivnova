import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryDays } from '../model/history';
import {
  demoFieldId,
  makeDashboard,
  makeFieldSummary,
  makeRotationAdvice,
  makeSeries,
  makeSoilForecast,
  makeWorkabilityWindow,
  makeYieldPrediction,
} from '@/entities/field/testing';
import type * as SharedApi from '@/shared/api';
import { ApiError, apiRequest } from '@/shared/api';
import { FieldInsights } from './FieldInsights';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

vi.mock('./FieldBoundaryMap', () => ({
  FieldBoundaryMap: ({ label }: { label: string }) => (
    <div role="region" aria-label={`Map of ${label}`} />
  ),
}));

const request = vi.mocked(apiRequest);

type Responses = Record<string, unknown>;

function respondWith(responses: Responses) {
  request.mockImplementation(async (path: string) => {
    const key = Object.keys(responses).find(
      (prefix) => path === prefix || path.startsWith(`${prefix}?`),
    );
    if (!key) throw new ApiError('not-found', 404, 'Not Found');
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value as never;
  });
}

function renderInsights(
  fieldId: string | undefined,
  days: HistoryDays | null = 14,
  onDaysChange = vi.fn(),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FieldInsights fieldId={fieldId} days={days} onDaysChange={onDaysChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onDaysChange };
}

const base = `/fields/${demoFieldId}`;

function openDetails(title: RegExp) {
  const card = screen.getByRole('article', { name: title });
  fireEvent.click(within(card).getByRole('button', { name: /^Details/ }));
}
const fieldName = makeFieldSummary().name;

function happyResponses(overrides: Responses = {}): Responses {
  return {
    [base]: makeFieldSummary(),
    [`${base}/dashboard`]: makeDashboard(),
    [`${base}/history`]: makeDashboard(),
    [`${base}/workability`]: makeWorkabilityWindow(),
    [`${base}/predictions/soil-forecast`]: makeSoilForecast(),
    [`${base}/predictions/yield`]: makeYieldPrediction(),
    ...overrides,
  };
}

describe('FieldInsights', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('shows a friendly state for an invalid id without calling the API', async () => {
    renderInsights('not-a-guid');
    expect(await screen.findByRole('heading', { name: 'Field not available' })).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it('treats a missing or private field the same way and links back to the explorer', async () => {
    respondWith({ [base]: new ApiError('not-found', 404, 'Not Found') });
    renderInsights(demoFieldId);
    expect(await screen.findByRole('heading', { name: 'Field not available' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Field Explorer/ }).getAttribute('href')).toBe('/');
  });

  it('offers a retry for temporary network errors', async () => {
    respondWith({ [base]: new ApiError('network', null, 'Unable to reach the server.') });
    renderInsights(demoFieldId);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders the field, three assessments and the actual history range', async () => {
    respondWith(happyResponses());
    renderInsights(demoFieldId);
    expect(await screen.findByRole('heading', { level: 1, name: fieldName })).toBeTruthy();
    expect(await screen.findByText('Irrigate 22.2 mm within 36h')).toBeTruthy();
    expect(screen.getByText('Field operations are possible')).toBeTruthy();
    expect(screen.getByText('No scouting needed now')).toBeTruthy();
    expect(screen.getAllByText(/Nov 1-14, 2026/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Back to Field Explorer/ }).getAttribute('href')).toBe(
      `/?field=${demoFieldId}`,
    );
  });

  it('labels demo values as sample data without a provenance footer', async () => {
    respondWith(happyResponses());
    renderInsights(demoFieldId);
    expect(await screen.findByText('Sample data')).toBeTruthy();
    expect(screen.queryByText('Simulated sample')).toBeNull();
  });

  it('warns when a personal field falls back to simulated values', async () => {
    respondWith(
      happyResponses({ [base]: makeFieldSummary({ isDemo: false, name: 'My North Plot' }) }),
    );
    renderInsights(demoFieldId);
    expect(await screen.findByText('Live NASA data unavailable')).toBeTruthy();
  });

  it('shows a missing rain forecast as unavailable, not as zero rain', async () => {
    const base0 = makeDashboard();
    respondWith(
      happyResponses({
        [`${base}/dashboard`]: makeDashboard({
          dataSource: 'NASA_POWER_LIVE',
          timeSeries: makeSeries(14, '2026-11-10'),
          workability: {
            ...base0.workability,
            sprayingSafe: null,
            rainForecast24hMm: null,
            rainForecast24To48hMm: null,
            forecastSource: null,
          },
        }),
      }),
    );
    renderInsights(demoFieldId);
    expect(await screen.findByText('Check rain first')).toBeTruthy();
    openDetails(/^Workability and spraying/);
    expect(await screen.findAllByText('Forecast unavailable')).toHaveLength(2);
    expect(screen.queryByText('NASA POWER has no forecast')).toBeNull();
  });

  it('labels a real rain forecast with its weather source', async () => {
    const base0 = makeDashboard();
    respondWith(
      happyResponses({
        [`${base}/dashboard`]: makeDashboard({
          dataSource: 'NASA_POWER_LIVE',
          workability: {
            ...base0.workability,
            rainForecast24hMm: 3.4,
            rainForecast24To48hMm: 0,
            forecastSource: 'OPEN_METEO_FORECAST',
          },
        }),
      }),
    );
    renderInsights(demoFieldId);
    await screen.findByText('Field operations are possible');
    openDetails(/^Workability and spraying/);
    expect(await screen.findAllByText('Open-Meteo forecast')).toHaveLength(2);
    expect(screen.getByText('3.4')).toBeTruthy();
  });

  it('requests history for the 30 day period', async () => {
    respondWith(happyResponses());
    renderInsights(demoFieldId, 30);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining(`${base}/history?from=`),
        expect.anything(),
      ),
    );
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining(`${base}/history?from=`),
      expect.anything(),
    );
  });

  it('asks the page to switch periods from the toggle', async () => {
    respondWith(happyResponses());
    const { onDaysChange } = renderInsights(demoFieldId);
    fireEvent.click(await screen.findByRole('button', { name: '30 days' }));
    expect(onDaysChange).toHaveBeenCalledWith(30);
  });

  it('shows a biomass anomaly as a reason to scout, not a diagnosis', async () => {
    const dashboard = makeDashboard();
    respondWith(
      happyResponses({
        [`${base}/dashboard`]: makeDashboard({
          stressAndIrrigation: { ...dashboard.stressAndIrrigation, irrigationRecommended: false },
          biomass: {
            ...dashboard.biomass,
            isAnomalyDetected: true,
            deltaPercent: -18.3,
            deltaNdvi: -0.13,
          },
        }),
      }),
    );
    renderInsights(demoFieldId);
    expect(await screen.findByText('Scout the field')).toBeTruthy();
    expect(screen.getByText('Decline detected')).toBeTruthy();
  });

  it('keeps the rest of the page when the workability window fails', async () => {
    respondWith(
      happyResponses({ [`${base}/workability`]: new ApiError('server', 500, 'Server error') }),
    );
    renderInsights(demoFieldId);
    await screen.findByText('Field operations are possible');
    openDetails(/^Workability and spraying/);
    expect(await screen.findByText(/48h periods unavailable/)).toBeTruthy();
    expect(screen.getByText('Irrigate 22.2 mm within 36h')).toBeTruthy();
  });

  it('keeps the header and map when analytics fail', async () => {
    respondWith(
      happyResponses({ [`${base}/dashboard`]: new ApiError('server', 500, 'Server error') }),
    );
    renderInsights(demoFieldId);
    expect(await screen.findByText('Field analytics are unavailable right now.')).toBeTruthy();
    expect(screen.getByRole('region', { name: `Map of ${fieldName}` })).toBeTruthy();
  });

  it('shows the backend 72-hour warning text unchanged', async () => {
    const forecast = makeSoilForecast({
      proactive72hStressWarning: true,
      forecastedDay3WaterDeficitIndex: 0.71,
      proactiveRecommendation:
        'Field #2 \u2014 North Corn: AI forecast projects rootzone moisture dropping to 0.22.',
    });
    respondWith(happyResponses({ [`${base}/predictions/soil-forecast`]: forecast }));
    renderInsights(demoFieldId);
    expect(await screen.findByText(/72-hour water stress warning/)).toBeTruthy();
    expect(document.body.textContent).toContain(forecast.proactiveRecommendation);
  });

  it('labels the forecast boundary with the actual last observation, not today', async () => {
    respondWith(happyResponses());
    renderInsights(demoFieldId);
    const notice = await screen.findByText('Model forecast from Nov 14');
    expect(notice.textContent).not.toMatch(/today/i);
  });

  it('keeps history when the forecast model is unavailable', async () => {
    respondWith(
      happyResponses({
        [`${base}/predictions/soil-forecast`]: new ApiError('server', 503, 'Model unavailable'),
      }),
    );
    renderInsights(demoFieldId);
    await screen.findAllByText(/Nov 1-14, 2026/);
    expect(await screen.findByText(/Forecast unavailable/)).toBeTruthy();
    expect(screen.getAllByText(/Nov 1-14, 2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/72-hour water stress warning/)).toBeNull();
  });

  describe('yield estimate', () => {
    function yieldSection() {
      return screen.getByRole('region', { name: 'Yield estimate' });
    }

    it('shows the backend estimate with units and the baseline comparison', async () => {
      respondWith(happyResponses());
      renderInsights(demoFieldId);
      await screen.findByText('Predicted yield');
      const section = within(yieldSection());
      expect(section.getByText('6.89')).toBeTruthy();
      expect(section.getByText('620')).toBeTruthy();
      expect(section.getByText('6.81')).toBeTruthy();
      expect(section.getByText('+1.2%')).toBeTruthy();
      expect(section.getByText('Above the regional average')).toBeTruthy();
      expect(section.getAllByText('t/ha')).toHaveLength(2);
      expect(section.getByText('t')).toBeTruthy();
    });

    it('labels the result as a model estimate, not an observed or guaranteed harvest', async () => {
      respondWith(happyResponses());
      renderInsights(demoFieldId);
      await screen.findByText('Predicted yield');
      const section = within(yieldSection());
      expect(section.getByText('Model estimate')).toBeTruthy();
      expect(section.getByText(/not a measured or guaranteed harvest/)).toBeTruthy();
      expect(section.queryByText(/confidence|accuracy/i)).toBeNull();
    });

    it('marks demo inputs as simulated', async () => {
      respondWith(happyResponses());
      renderInsights(demoFieldId);
      await screen.findByText('Predicted yield');
      expect(within(yieldSection()).getByText('Simulated inputs')).toBeTruthy();
    });

    it('does not mark live inputs as simulated', async () => {
      respondWith(
        happyResponses({
          [`${base}/dashboard`]: makeDashboard({ dataSource: 'NASA_POWER_LIVE' }),
        }),
      );
      renderInsights(demoFieldId);
      await screen.findByText('Predicted yield');
      expect(within(yieldSection()).queryByText('Simulated inputs')).toBeNull();
    });

    it('shows model details and input features on demand', async () => {
      respondWith(happyResponses());
      renderInsights(demoFieldId);
      fireEvent.click(await screen.findByRole('button', { name: 'Show model details' }));
      const section = within(yieldSection());
      expect(section.getByText('yield_model.onnx')).toBeTruthy();
      expect(section.getByText('28.5')).toBeTruthy();
      expect(section.getByText('0.304')).toBeTruthy();
      expect(section.getByText('10')).toBeTruthy();
    });

    it('shows n/a for invalid secondary values instead of inventing them', async () => {
      respondWith(
        happyResponses({
          [`${base}/predictions/yield`]: makeYieldPrediction({
            estimatedTotalHarvestTons: Number.NaN,
            regionalBaselineTonsPerHa: Number.NaN,
          }),
        }),
      );
      renderInsights(demoFieldId);
      await screen.findByText('Predicted yield');
      expect(within(yieldSection()).getAllByText('n/a')).toHaveLength(3);
    });

    it('says so when the model returns no usable yield', async () => {
      respondWith(
        happyResponses({
          [`${base}/predictions/yield`]: makeYieldPrediction({
            predictedYieldTonsPerHa: Number.NaN,
          }),
        }),
      );
      renderInsights(demoFieldId);
      expect(
        await screen.findByText('The model did not return a usable yield estimate for this field.'),
      ).toBeTruthy();
    });

    it('keeps the rest of the page when the prediction fails and recovers on retry', async () => {
      let fail = true;
      const responses = happyResponses();
      respondWith(responses);
      const success = makeYieldPrediction();
      request.mockImplementation(async (path: string) => {
        if (path === `${base}/predictions/yield`) {
          if (fail) throw new ApiError('server', 500, 'Server Error');
          return success as never;
        }
        const key = Object.keys(responses).find(
          (prefix) => path === prefix || path.startsWith(`${prefix}?`),
        );
        if (!key) throw new ApiError('not-found', 404, 'Not Found');
        return responses[key] as never;
      });
      renderInsights(demoFieldId);

      expect(await screen.findByText('Yield estimate unavailable right now.')).toBeTruthy();
      expect(screen.getByText('Irrigate 22.2 mm within 36h')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Current conditions' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();

      fail = false;
      fireEvent.click(within(yieldSection()).getByRole('button', { name: 'Retry' }));
      expect(await within(yieldSection()).findByText('6.89')).toBeTruthy();
    });
  });

  describe('rotation advisor', () => {
    it('stays collapsed and does not call the advisor until opened', async () => {
      respondWith(happyResponses());
      renderInsights(demoFieldId);
      expect(await screen.findByRole('button', { name: /Plan the next season/ })).toBeTruthy();
      expect(request.mock.calls.some(([path]) => String(path).includes('rotation-advisor'))).toBe(
        false,
      );
    });

    it('shows the recommended crop, ranked options and the estimate caveat', async () => {
      respondWith(happyResponses({ [`${base}/rotation-advisor`]: makeRotationAdvice() }));
      renderInsights(demoFieldId);
      fireEvent.click(await screen.findByRole('button', { name: /Plan the next season/ }));

      expect(await screen.findByText('Suggested next crop')).toBeTruthy();
      expect(screen.getByText('Soy')).toBeTruthy();
      expect(screen.getByText('Other options, ranked')).toBeTruthy();
      expect(screen.getByText('current')).toBeTruthy();
      expect(screen.getByText(/not\s+as a guaranteed outcome/)).toBeTruthy();
      expect(request).toHaveBeenCalledWith(`${base}/rotation-advisor?priority=Balanced`, {
        signal: expect.anything(),
      });
    });

    it('requests the chosen priority', async () => {
      respondWith(happyResponses({ [`${base}/rotation-advisor`]: makeRotationAdvice() }));
      renderInsights(demoFieldId);
      fireEvent.click(await screen.findByRole('button', { name: /Plan the next season/ }));
      await screen.findByText('Suggested next crop');
      fireEvent.click(screen.getByRole('button', { name: 'Save water' }));
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          `${base}/rotation-advisor?priority=WaterConservation`,
          { signal: expect.anything() },
        ),
      );
    });

    it('offers a retry when the advisor fails', async () => {
      respondWith(
        happyResponses({
          [`${base}/rotation-advisor`]: new ApiError('server', 500, 'Server Error'),
        }),
      );
      renderInsights(demoFieldId);
      fireEvent.click(await screen.findByRole('button', { name: /Plan the next season/ }));
      expect(await screen.findByText('Rotation advice is unavailable right now.')).toBeTruthy();
      expect(screen.getByText('Irrigate 22.2 mm within 36h')).toBeTruthy();
    });
  });
});

it('shows an empty future season without fetching unrelated history', async () => {
  request.mockReset();
  respondWith(happyResponses({ [base]: makeFieldSummary({ plantedAt: '2100-01-01' }) }));
  renderInsights(demoFieldId, 'season');
  expect(await screen.findByText(/This season has not started/)).toBeTruthy();
  expect(request.mock.calls.some(([path]) => path.includes('/history?'))).toBe(false);
});

it('shows season selector and planting date in the history request', async () => {
  const plantedAt = new Date().toISOString().slice(0, 10);
  respondWith(happyResponses({ [base]: makeFieldSummary({ plantedAt }) }));
  renderInsights(demoFieldId, 'season');
  expect(await screen.findByRole('button', { name: 'This season' })).toHaveProperty(
    'ariaPressed',
    'true',
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining(`/history?from=${plantedAt}&to=`),
      expect.anything(),
    ),
  );
});

describe('default history period', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('shows this season by default when the season has observations', async () => {
    respondWith(happyResponses());
    renderInsights(demoFieldId, null);
    const season = await screen.findByRole('button', { name: 'This season' });
    await waitFor(() => expect(season.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.queryByText(/so the last 14 days are shown/)).toBeNull();
  });

  it('falls back to the last 14 days when the season has no observations', async () => {
    respondWith(happyResponses({ [`${base}/history`]: makeDashboard({ timeSeries: [] }) }));
    renderInsights(demoFieldId, null);
    expect(
      await screen.findByText(
        'No observations for this season yet, so the last 14 days are shown.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '14 days' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
