import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';
import type { Person, Plan } from '@/services';

const STATIC = { staleTime: Infinity } as const;

export function useCities() {
  const services = useServices();
  return useQuery({ queryKey: ['catalog', 'cities'], queryFn: () => services.catalog.cities(), ...STATIC });
}

export function useCategories() {
  const services = useServices();
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: () => services.catalog.categories(), ...STATIC });
}

export function useInterests() {
  const services = useServices();
  return useQuery({ queryKey: ['catalog', 'interests'], queryFn: () => services.catalog.interests(), ...STATIC });
}

/** Looks people up by id; unknown ids are skipped, never shown as blanks. */
export function usePeople() {
  const services = useServices();
  const query = useQuery({ queryKey: ['catalog', 'people'], queryFn: () => services.catalog.people(), ...STATIC });
  const byId = React.useMemo(
    () => new Map<string, Person>((query.data ?? []).map((p) => [p.id, p])),
    [query.data],
  );
  const memberNames = React.useCallback(
    (plan: Plan) =>
      plan.members.map((m) => byId.get(m.personId)?.displayName).filter((n): n is string => !!n),
    [byId],
  );
  return { ...query, byId, memberNames };
}
