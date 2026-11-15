import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldQueryKeys } from '@/entities/field';
import { makeFieldSummary } from '@/entities/field/testing';
import type * as SharedApi from '@/shared/api';
import { ApiError, apiRequest } from '@/shared/api';
import { EditFieldPage } from './EditFieldPage';

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiRequest: vi.fn(),
}));

vi.mock('@/features/draw-field', () => ({
  DrawFieldMap: () => <div role="region" aria-label="Boundary map" />,
}));

const request = vi.mocked(apiRequest);
const myField = makeFieldSummary({
  id: '33333333-3333-3333-3333-333333333333',
  name: 'Home Wheat',
  cropType: 'Wheat',
  isDemo: false,
});
const signedIn = {
  authenticated: true,
  user: { id: 'u1', displayName: 'Farmer', email: 'f@example.com' },
};

function respond(initial: unknown, patchResult?: unknown) {
  let field = initial;
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === '/auth/me') return signedIn as never;
    if (path.startsWith('/fields/') && options?.method === 'PATCH') {
      if (patchResult instanceof Error) throw patchResult;
      field = patchResult;
      return patchResult as never;
    }
    if (path.startsWith('/fields/')) {
      if (field instanceof Error) throw field;
      return field as never;
    }
    return [] as never;
  });
}

function renderPage(id: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/fields/${id}/edit`]}>
        <Routes>
          <Route path="fields/:id/edit" element={<EditFieldPage />} />
          <Route path="fields/:id" element={<p>Insights page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe('EditFieldPage', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('keeps demo fields read-only', async () => {
    respond(makeFieldSummary());
    renderPage(makeFieldSummary().id);
    expect(await screen.findByRole('heading', { name: 'Demo fields are read-only' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('treats a missing or foreign field as unavailable', async () => {
    respond(new ApiError('not-found', 404, 'Not Found'));
    renderPage(myField.id);
    expect(await screen.findByRole('heading', { name: 'Field not available' })).toBeTruthy();
  });

  it('saves only the changed details and returns to the field', async () => {
    const updated = { ...myField, name: 'River Plot' };
    respond(myField, updated);
    const client = renderPage(myField.id);

    const name = await screen.findByLabelText(/Field name/);
    fireEvent.change(name, { target: { value: 'River Plot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Insights page')).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/fields/${myField.id}`, {
      method: 'PATCH',
      json: { name: 'River Plot' },
    });
    expect(client.getQueryData(fieldQueryKeys.detail(myField.id))).toMatchObject({
      name: 'River Plot',
    });
  });

  it('shows validation and server errors without leaving the page', async () => {
    respond(
      myField,
      new ApiError('http', 400, 'Bad Request', {
        errors: { Name: ['A field with this name already exists.'] },
      }),
    );
    renderPage(myField.id);

    const name = await screen.findByLabelText(/Field name/);
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a field name.')).toBeTruthy();

    fireEvent.change(name, { target: { value: 'Duplicate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('A field with this name already exists.')).toBeTruthy();
    expect(screen.queryByText('Insights page')).toBeNull();
  });

  it('asks before discarding unsaved changes', async () => {
    respond(myField);
    renderPage(myField.id);

    fireEvent.change(await screen.findByLabelText(/Field name/), {
      target: { value: 'Changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/Discard your changes\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.getByText('Insights page')).toBeTruthy());
  });
});
