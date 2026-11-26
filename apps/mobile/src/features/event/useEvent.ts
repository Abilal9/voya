import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';
import { canDo, eventRole, isHost } from '@/services/eventRules';
import { classifyPlan } from '@/services/planRules';
import type { RSVP, VoyaEvent } from '@/services';
import { useSession } from '@/stores/session';

/**
 * One event from the shared plan service, from the signed-in person's side.
 * Guests receive the guest projection from the service (no host-only items,
 * no other guests' identities). Every mutation goes through `run`, which
 * refreshes the event and the plan lists.
 */
export function useEvent(id: string | undefined) {
  const services = useServices();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const me = account?.personId ?? account?.id ?? '';
  const query = useQuery({
    queryKey: ['plan', id],
    queryFn: () => services.plans.get(id!),
    enabled: !!id,
  });
  const event = query.data?.type === 'event' ? (query.data as VoyaEvent) : undefined;
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

  // Guests see a projection without identities; their own row is marked.
  const ownGuest = event?.viewerGuestId ? event.guests.find((g) => g.id === event.viewerGuestId) : undefined;
  const role = !event ? 'none' : ownGuest ? (ownGuest.rsvp === 'pending' ? 'invited' : 'guest') : eventRole(event, me);
  const myRsvp: RSVP | undefined = ownGuest?.rsvp;
  const managing = role === 'host' || role === 'co-host';
  return {
    ...query,
    services,
    event,
    me,
    role,
    myRsvp,
    managing,
    isHost: !!event && isHost(event, me),
    can: {
      edit: !!event && canDo(event, me, 'plan.edit'),
      guests: !!event && canDo(event, me, 'member.manage'),
      invite: !!event && canDo(event, me, 'invite.create'),
      schedule: !!event && canDo(event, me, 'schedule.edit'),
    },
    /** Cancelled or past: read-only for everyone. */
    closed: !!event && (event.lifecycle === 'cancelled' || classifyPlan(event) === 'past'),
    busy,
    error,
    setError,
    run,
  };
}

export type EventHook = ReturnType<typeof useEvent> & { event: VoyaEvent };
