import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldQueryKeys } from '@/entities/field';
import { startDemoSession, userQueryKeys } from '@/entities/user';

export function useDemoSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startDemoSession,
    onSuccess: async (session) => {
      queryClient.setQueryData(userQueryKeys.current, session);
      await queryClient.cancelQueries({ queryKey: fieldQueryKeys.all });
      await Promise.all([
        queryClient.resetQueries({ queryKey: fieldQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: userQueryKeys.current }),
      ]);
    },
  });
}
