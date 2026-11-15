import { apiRequest } from '@/shared/api';
import type { ActiveAlert, AlertFeedbackRequest } from '../model/types';

export function getActiveAlerts(signal?: AbortSignal): Promise<ActiveAlert[]> {
  return apiRequest('/alerts', { signal });
}

export function submitAlertFeedback(
  alertId: string,
  request: AlertFeedbackRequest,
): Promise<{ feedbackId: string; recordedAtUtc: string }> {
  return apiRequest(`/alerts/${encodeURIComponent(alertId)}/feedback`, {
    method: 'POST',
    json: request,
  });
}
