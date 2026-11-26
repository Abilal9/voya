import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';
import type { AccountSettings, NotificationKey } from '@/services';

type Patch = Partial<Omit<AccountSettings, 'notifications'>> & {
  notifications?: Partial<Record<NotificationKey, boolean>>;
};

/** Per-account preferences (V04–V06), saved on every change. */
export function useSettings() {
  const services = useServices();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => services.profile.getSettings() });
  const mutation = useMutation({
    mutationFn: (patch: Patch) => services.profile.updateSettings(patch),
    // Show the change at once; roll back if saving fails.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['settings'] });
      const previous = qc.getQueryData<AccountSettings>(['settings']);
      if (previous) {
        qc.setQueryData<AccountSettings>(['settings'], {
          ...previous, ...patch, notifications: { ...previous.notifications, ...(patch.notifications ?? {}) },
        });
      }
      return { previous };
    },
    onError: (_e, _p, ctx) => ctx?.previous && qc.setQueryData(['settings'], ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
  return { ...query, update: mutation.mutate, saveError: mutation.error };
}
