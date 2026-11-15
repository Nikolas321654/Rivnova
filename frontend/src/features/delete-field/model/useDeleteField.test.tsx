import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fieldQueryKeys } from '@/entities/field';
import { makeAlert, makeFieldSummary } from '@/entities/field/testing';
import type * as SharedApi from '@/shared/api';
import { apiRequest } from '@/shared/api';
import { useDeleteField } from './useDeleteField';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

describe('useDeleteField', () => {
  it('refreshes alerts so the deleted field drops out of Today’s actions', async () => {
    const field = makeFieldSummary({ id: '33333333-3333-3333-3333-333333333333', isDemo: false });
    vi.mocked(apiRequest).mockImplementation(async (path: string) =>
      path === '/alerts' ? ([] as never) : (undefined as never),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(fieldQueryKeys.alerts(), [makeAlert({ fieldId: field.id })]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteField(), { wrapper });
    await act(() => result.current.mutateAsync(field.id));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: fieldQueryKeys.alerts() });
    expect(client.getQueryState(fieldQueryKeys.alerts())?.isInvalidated).toBe(true);
  });
});
