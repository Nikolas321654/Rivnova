import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fieldQueryKeys,
  updateField,
  type FieldSummary,
  type UpdateFieldRequest,
} from '@/entities/field';

export function useUpdateField(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateFieldRequest) => updateField(id, request),
    onSuccess: async (field) => {
      queryClient.setQueryData(fieldQueryKeys.detail(id), field);
      queryClient.setQueryData<FieldSummary[]>(fieldQueryKeys.list(), (fields) =>
        fields?.map((item) => (item.id === id ? field : item)),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fieldQueryKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: fieldQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: fieldQueryKeys.alerts() }),
      ]);
    },
  });
}
