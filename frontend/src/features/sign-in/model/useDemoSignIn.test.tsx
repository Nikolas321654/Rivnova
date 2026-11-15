import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fieldQueryKeys } from '@/entities/field';
import type * as SharedApi from '@/shared/api';
import { apiRequest } from '@/shared/api';
import { useDemoSignIn } from './useDemoSignIn';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

describe('useDemoSignIn', () => {
  it('refetches field data that is on screen instead of leaving it pending', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ authenticated: true, user: { id: 'u1' } } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const dashboardFetch = vi.fn(async () => ({ fetchedAt: dashboardFetch.mock.calls.length }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({
        dashboard: useQuery({
          queryKey: fieldQueryKeys.dashboard('field-1'),
          queryFn: dashboardFetch,
        }),
        signIn: useDemoSignIn(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.dashboard.isSuccess).toBe(true));
    expect(dashboardFetch).toHaveBeenCalledTimes(1);

    await act(() => result.current.signIn.mutateAsync());

    await waitFor(() => expect(dashboardFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.dashboard.isSuccess).toBe(true));
  });
});
