import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { makeDashboard } from '@/entities/field/testing';
import { WorkabilitySection } from './WorkabilitySection';

it.each([null, undefined])('omits units for unavailable recent rainfall (%s)', (missing) => {
  const dashboard = makeDashboard();
  dashboard.workability = {
    ...dashboard.workability,
    rainLast12hMm: missing,
    rainLast24hMm: missing,
    rainForecast24hMm: 0,
    rainForecast24To48hMm: 9.5,
    forecastSource: 'OPEN_METEO_FORECAST',
  };
  render(
    <WorkabilitySection
      dashboard={dashboard}
      window={undefined}
      windowState="pending"
      onRetryWindow={vi.fn()}
    />,
  );
  expect(screen.getByText('Rain, 12h').nextElementSibling?.textContent).toBe('n/a');
  expect(screen.getByText('Rain, 24h').nextElementSibling?.textContent).toBe('n/a');
  expect(screen.getAllByText('Open-Meteo forecast')).toHaveLength(2);
  expect(screen.getByText('Rain forecast, 24h').nextElementSibling?.textContent).toContain('0');
});
