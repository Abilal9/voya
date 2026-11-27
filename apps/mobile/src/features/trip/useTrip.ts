import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';
import { classifyPlan, relationTo } from '@/services/planRules';
import type { Trip } from '@/services';
import { useSession } from '@/stores/session';

/**
 * One trip from the shared plan service, from the signed-in person's side.
 * Every mutation goes through `run`, which refreshes the trip and the plan
 * lists so every screen shows the same canonical trip.
 */
export function useTrip(id: string | undefined) {
  const services = useServices();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const me = account?.personId ?? account?.id ?? '';
  const query = useQuery({ queryKey: ['plan', id], queryFn: () => services.plans.get(id!), enabled: !!id });
  const trip = query.data?.type === 'trip' ? (query.data as Trip) : undefined;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const run = React.useCallback(
    async <T,>(op: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(undefined);
      try {
        const result = await op();
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['plan', id] }),
          qc.invalidateQueries({ queryKey: ['plans'] }),
        ]);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [qc, id],
  );

  const member = trip?.members.find((m) => m.personId === me);
  return {
    ...query,
    services,
    trip,
    me,
    relation: trip ? relationTo(trip, me) : 'none',
    isOrganizer: !!member?.capabilities.includes('plan.edit'),
    canBuild: !!member?.capabilities.includes('timeline.finalize'),
    closed: !!trip && (trip.lifecycle === 'cancelled' || classifyPlan(trip) === 'past'),
    busy,
    error,
    setError,
    run,
  };
}

export type TripHook = ReturnType<typeof useTrip> & { trip: Trip };
