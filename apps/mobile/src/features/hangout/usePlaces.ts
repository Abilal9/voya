import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/services/ServicesProvider';
import type { Place } from '@/services';

/** Looks up the places a plan refers to; unknown ids are simply skipped. */
export function usePlaces(ids: string[]) {
  const services = useServices();
  const key = [...new Set(ids)].sort();
  const query = useQuery({
    queryKey: ['places', 'byIds', key.join(',')],
    queryFn: async () => {
      const found = await Promise.all(key.map((id) => services.places.getPlace(id).catch(() => undefined)));
      return new Map(found.filter((p): p is Place => !!p).map((p) => [p.id, p]));
    },
    enabled: key.length > 0,
  });
  return query.data ?? new Map<string, Place>();
}
