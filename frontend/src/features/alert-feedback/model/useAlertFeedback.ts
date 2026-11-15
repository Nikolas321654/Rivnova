import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fieldQueryKeys,
  submitAlertFeedback,
  type ActiveAlert,
  type AlertAction,
} from '@/entities/field';

type FeedbackTarget = Pick<AlertAction, 'id' | 'fieldId' | 'alertType'>;

export function useAlertFeedback(alert: FeedbackTarget) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['alert-feedback', alert.id],
    mutationFn: (isAccurate: boolean) =>
      submitAlertFeedback(alert.id, {
        fieldId: alert.fieldId,
        alertType: alert.alertType,
        isAccurate,
      }),
    onSuccess: async (_, isAccurate) => {
      queryClient.setQueryData<ActiveAlert[]>(fieldQueryKeys.alerts(), (alerts) =>
        alerts?.map((item) =>
          item.id === alert.id ? { ...item, userFeedbackAccurate: isAccurate } : item,
        ),
      );
      await queryClient.invalidateQueries({ queryKey: fieldQueryKeys.alerts() });
    },
  });
}
