import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeFieldSummary } from '@/entities/field/testing';
import { FieldSidebar } from './FieldSidebar';

function renderSidebar(onTabChange = vi.fn()) {
  render(
    <MemoryRouter>
      <FieldSidebar
        fields={[makeFieldSummary()]}
        selectedFieldId={null}
        hoveredFieldId={null}
        onSelectField={vi.fn()}
        onHoverField={vi.fn()}
        activeTab="mine"
        onTabChange={onTabChange}
        authenticated
        loading={false}
        error={false}
        onRetryFields={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onTabChange;
}

describe('FieldSidebar My Fields empty state', () => {
  it('offers drawing, GeoJSON import and a quiet way back to demo fields', () => {
    const onTabChange = renderSidebar();
    expect(screen.getByText('Start your first field')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Draw on the map' }).getAttribute('href')).toBe(
      '/fields/new?draw=true',
    );
    expect(screen.getByRole('button', { name: 'Import GeoJSON' })).toBeTruthy();
    expect(screen.queryByText('Add Field')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Or explore the demo fields' }));
    expect(onTabChange).toHaveBeenCalledWith('demo');
  });
});
