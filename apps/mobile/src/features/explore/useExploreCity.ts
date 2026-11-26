import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCities } from '@/features/catalog';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';

/**
 * Explore's city, shared by Explore, Search, Filters and the location picker
 * and kept per account across launches. "Near me" is mocked: no location is
 * read; it is the account's city when Voya has places there, else the first city.
 */
export function useExploreCity() {
  const services = useServices();
  const qc = useQueryClient();
  const cities = useCities();
  const accountCity = useSession((s) => s.account?.city);
  // Query data must not be undefined, so "near me" is stored in the cache as null.
  const chosen = useQuery({
    queryKey: ['explore', 'city'],
    queryFn: async () => (await services.places.exploreCity()) ?? null,
  });

  const withPlaces = cities.data ?? [];
  const homeCity = accountCity && withPlaces.includes(accountCity) ? accountCity : withPlaces[0];
  const city = chosen.data ?? homeCity;

  const choose = React.useCallback(
    async (next: string | null) => {
      await services.places.chooseCity(next);
      await qc.invalidateQueries({ queryKey: ['explore', 'city'] });
      await qc.invalidateQueries({ queryKey: ['locations', 'recent'] });
    },
    [services, qc],
  );

  return {
    city,
    homeCity,
    isNearMe: !chosen.data || chosen.data === homeCity,
    ready: chosen.isFetched && !!homeCity,
    choose,
  };
}
