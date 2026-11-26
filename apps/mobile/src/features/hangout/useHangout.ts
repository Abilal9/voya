import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';
import { relationTo } from '@/services/planRules';
import type { Hangout } from '@/services';
import { useSession } from '@/stores/session';

/**
 * One hangout from the shared plan service, plus who "I" am on it. Every
 * mutation goes through `run`, which refreshes the hangout and plan lists so
 * all screens show the same canonical state.
 */
export function useHangout(id: string | undefined) {
  const services = useServices();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const me = account?.personId ?? account?.id ?? '';
  const query = useQuery({
    queryKey: ['plan', id],
    queryFn: () => services.plans.get(id!),
    enabled: !!id,
  });
  const hangout = query.data?.type === 'hangout' ? (query.data as Hangout) : undefined;
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

  const relation = hangout ? relationTo(hangout, me) : 'none';
  return {
    ...query,
    services,
    hangout,
    me,
    relation,
    isOrganizer: !!hangout && hangout.ownerId === me,
    myResponse: hangout?.invites?.find((i) => i.personId === me)?.status ?? (hangout?.ownerId === me ? 'in' : undefined),
    busy,
    error,
    setError,
    run,
  };
}
