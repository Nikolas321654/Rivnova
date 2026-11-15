import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldQueryKeys } from '@/entities/field';
import { userQueryKeys } from '@/entities/user';
import type * as SharedApi from '@/shared/api';
import { ApiError, apiRequest } from '@/shared/api';
import { SignInDialog } from './SignInDialog';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

const request = vi.mocked(apiRequest);
const demoSession = {
  authenticated: true,
  user: {
    id: 'u1',
    displayName: 'Demo Farmer',
    email: 'demo@farmflow.local',
    isDemoAccount: true,
  },
};

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(userQueryKeys.current, { authenticated: false, user: null });
  client.setQueryData(fieldQueryKeys.list(), [{ id: 'demo-only' }]);
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SignInDialog returnTo="/fields/new" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { client, onClose };
}

describe('SignInDialog demo farmer', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('starts a demo session in place and refreshes the session and fields', async () => {
    request.mockImplementation(async (path: string) =>
      path === '/auth/demo' ? (demoSession as never) : ([] as never),
    );
    const { client, onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Try as Demo Farmer' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/auth/demo', { method: 'POST' });
    expect(client.getQueryData(userQueryKeys.current)).toMatchObject({ authenticated: true });
    expect(client.getQueryData(fieldQueryKeys.list())).toBeUndefined();
  });

  it('explains when demo sign-in is disabled on the server', async () => {
    request.mockImplementation(async () => {
      throw new ApiError('not-found', 404, 'Not Found');
    });
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Try as Demo Farmer' }));

    expect(
      await screen.findByText('Demo Farmer sign-in is not enabled on this server.'),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
