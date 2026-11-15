import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title, text and actions with decorative stickers', () => {
    const { container } = render(
      <EmptyState
        stickers={['landscape', 'seedling']}
        title="Start your first field"
        text="One short line."
        actions={<button type="button">Act</button>}
      />,
    );
    expect(screen.getByText('Start your first field')).toBeTruthy();
    expect(screen.getByText('One short line.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Act' })).toBeTruthy();
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    images.forEach((image) => expect(image.getAttribute('alt')).toBe(''));
    expect(screen.queryByRole('img')).toBeNull();
  });
});
