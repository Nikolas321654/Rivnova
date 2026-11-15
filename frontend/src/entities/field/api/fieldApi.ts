import { apiRequest } from '@/shared/api';
import type { CreateFieldRequest, FieldSummary, UpdateFieldRequest } from '../model/types';

export function getFields(signal?: AbortSignal): Promise<FieldSummary[]> {
  return apiRequest('/fields', { signal });
}

export function getFieldById(id: string, signal?: AbortSignal): Promise<FieldSummary> {
  return apiRequest(`/fields/${encodeURIComponent(id)}`, { signal });
}

export function createField(request: CreateFieldRequest): Promise<FieldSummary> {
  return apiRequest('/fields', { method: 'POST', json: request });
}

export function updateField(id: string, request: UpdateFieldRequest): Promise<FieldSummary> {
  return apiRequest(`/fields/${encodeURIComponent(id)}`, { method: 'PATCH', json: request });
}

export function deleteField(id: string): Promise<void> {
  return apiRequest(`/fields/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
