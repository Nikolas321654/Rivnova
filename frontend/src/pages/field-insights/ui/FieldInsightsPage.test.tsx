import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FieldInsightsPage } from './FieldInsightsPage';

vi.mock('@/entities/field', () => ({ useFields: () => ({ data: [] }) }));
vi.mock('@/entities/user', () => ({ useCurrentUser: () => ({ data: { authenticated: true } }) }));
vi.mock('@/widgets/app-shell', () => ({
  AppShell: ({
    panelContent,
    children,
  }: {
    panelContent: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {panelContent}
      {children}
    </>
  ),
}));
vi.mock('@/widgets/field-sidebar', () => ({
  FieldSidebar: ({ onSelectField }: { onSelectField: (id: string) => void }) => (
    <button onClick={() => onSelectField('second')}>Switch field</button>
  ),
}));
vi.mock('@/widgets/field-insights', async () => {
  const { parseHistoryDays } = await import('../../../widgets/field-insights/model/history');
  return {
    parseHistoryDays,
    FieldInsights: ({
      days,
      onDaysChange,
    }: {
      days: string | number | null;
      onDaysChange: (days: number) => void;
    }) => (
      <>
        <span>Period: {days ?? 'auto'}</span>
        <button onClick={() => onDaysChange(30)}>Choose 30</button>
      </>
    ),
  };
});

function Location() {
  const location = useLocation();
  return (
    <span>
      {location.pathname}
      {location.search}
    </span>
  );
}

describe('history URL', () => {
  it('lets the widget pick the period by default and preserves a chosen one when switching fields', () => {
    render(
      <MemoryRouter initialEntries={['/fields/first']}>
        <Routes>
          <Route
            path="/fields/:id"
            element={
              <>
                <FieldInsightsPage />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Period: auto')).toBeTruthy();
    fireEvent.click(screen.getByText('Choose 30'));
    expect(screen.getByText('/fields/first?days=30')).toBeTruthy();
    fireEvent.click(screen.getByText('Switch field'));
    expect(screen.getByText('/fields/second?days=30')).toBeTruthy();
  });
});
