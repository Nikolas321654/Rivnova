import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fieldQueryKeys } from '@/entities/field';
import { makeAlert } from '@/entities/field/testing';
import type * as SharedApi from '@/shared/api';
import { apiRequest } from '@/shared/api';
import { useLogout } from './useLogout';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

describe('useLogout', () => {
  it('clears private alerts and asks for the guest alerts again', async () => {
    vi.mocked(apiRequest).mockResolvedValue(undefined as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(fieldQueryKeys.alerts(), [
      makeAlert({ fieldId: '33333333-3333-3333-3333-333333333333' }),
    ]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLogout(), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(client.getQueryData(fieldQueryKeys.alerts())).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: fieldQueryKeys.alerts() });
  });
});
