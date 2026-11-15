import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateField } from './DateField';

describe('DateField', () => {
  it('opens the selected month and selects a leap day in ISO format', () => {
    const onChange = vi.fn();
    render(<DateField id="date" label="Planting date" value="2024-02-10" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose planting date' }));
    expect(screen.queryByRole('button', { name: '2024-02-30' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2024-02-29' }));
    expect(onChange).toHaveBeenCalledWith('2024-02-29');
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('navigates across years and closes on Escape without changing the date', () => {
    const onChange = vi.fn();
    render(<DateField id="date" label="Planting date" value="2025-12-31" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose planting date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: '2026-01-01' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next month' }), { key: 'Escape' });
    expect(screen.queryByRole('group')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps focus while picking a day, so Safari does not close the calendar first', () => {
    const onChange = vi.fn();
    render(<DateField id="date" label="Planting date" value="2026-04-10" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose planting date' }));
    const day = screen.getByRole('button', { name: '2026-04-15' });
    expect(fireEvent.mouseDown(day)).toBe(false);
    fireEvent.click(day);
    expect(onChange).toHaveBeenCalledWith('2026-04-15');
  });
});
