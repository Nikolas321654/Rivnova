import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alertToAction, fieldQueryKeys, type ActiveAlert } from '@/entities/field';
import { makeAlert } from '@/entities/field/testing';
import { userQueryKeys } from '@/entities/user';
import type * as SharedApi from '@/shared/api';
import { ApiError, apiRequest } from '@/shared/api';
import { AlertFeedback } from './AlertFeedback';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

const request = vi.mocked(apiRequest);
const alert = makeAlert({ id: 'alert-1' });

function renderFeedback(authenticated: boolean, stored: ActiveAlert = alert) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(
    userQueryKeys.current,
    authenticated
      ? { authenticated: true, user: { id: 'u1', displayName: 'F', email: 'f@example.com' } }
      : { authenticated: false, user: null },
  );
  client.setQueryData(fieldQueryKeys.alerts(), [stored]);
  render(
    <QueryClientProvider client={client}>
      <AlertFeedback alert={alertToAction(stored)} />
    </QueryClientProvider>,
  );
  return client;
}

describe('AlertFeedback', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('is hidden for guests', () => {
    renderFeedback(false);
    expect(screen.queryByText('Accurate?')).toBeNull();
  });

  it('sends the actual alert id, field and type once and updates the cached alert', async () => {
    request.mockResolvedValue({ feedbackId: 'f1', recordedAtUtc: '' } as never);
    const client = renderFeedback(true);

    expect(screen.getByRole('group', { name: /^Was this alert accurate\?/ })).toBeTruthy();
    expect(screen.getByText('Accurate?')).toBeTruthy();
    const yes = screen.getByRole('button', { name: 'Yes' });
    fireEvent.click(yes);
    fireEvent.click(yes);

    await screen.findByText('Thanks, feedback saved.');
    expect(screen.queryByText('Accurate?')).toBeNull();
    const posts = request.mock.calls.filter(([path]) => path === '/alerts/alert-1/feedback');
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toEqual({
      method: 'POST',
      json: { fieldId: alert.fieldId, alertType: alert.alertType, isAccurate: true },
    });
    expect(client.getQueryData<ActiveAlert[]>(fieldQueryKeys.alerts())?.[0]).toMatchObject({
      userFeedbackAccurate: true,
    });
  });

  it('hides the question when the user already answered', () => {
    renderFeedback(true, { ...alert, userFeedbackAccurate: false });
    expect(screen.queryByText('Accurate?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
  });

  it('reports a failed submission', async () => {
    request.mockImplementation(async () => {
      throw new ApiError('server', 500, 'Server Error');
    });
    renderFeedback(true);

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(await screen.findByText('Feedback was not saved. Try again.')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'No' }).hasAttribute('disabled')).toBe(false),
    );
  });
});
