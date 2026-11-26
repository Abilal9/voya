import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';

/**
 * The ONE source of Saved state for every screen (Explore card + buttons,
 * Search results, Place details, Saved). All read the same ['saved'] query and
 * every toggle invalidates it, so a save anywhere shows everywhere.
 */
export function useSavedPlaces() {
  const services = useServices();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => services.saved.list() });
  const ids = React.useMemo(() => new Set((saved.data ?? []).map((s) => s.placeId)), [saved.data]);

  const toggle = React.useCallback(
    async (placeId: string) => {
      if (ids.has(placeId)) await services.saved.unsave(placeId);
      else await services.saved.save(placeId);
      await qc.invalidateQueries({ queryKey: ['saved'] });
    },
    [ids, services, qc],
  );

  return { ...saved, ids, isSaved: (placeId: string) => ids.has(placeId), toggle };
}
