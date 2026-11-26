import { create } from 'zustand';
import type { PlaceCategory, PlacesQuery } from '@/services';

/**
 * Explore filters (E07). UI state shared by Explore, the Filters sheet and
 * Search results. Not persisted: a fresh launch starts unfiltered, as the board shows.
 */
export interface ExploreFilters {
  categories: PlaceCategory[];
  prices: string[];
  distance: DistanceOption;
  rating?: RatingOption;
  openNow: boolean;
  tags: string[];
}

export const DISTANCE_OPTIONS = ['Nearby', '5 km', '10 km', '25 km', 'Any'] as const;
export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];
export const RATING_OPTIONS = ['4.0+', '4.5+'] as const;
export type RatingOption = (typeof RATING_OPTIONS)[number];
export const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$'] as const;
export const TAG_OPTIONS = ['Popular', 'Hidden gems', 'Good for groups'] as const;

/** "Nearby" is a short walk or drive; the board gives no number, 2 km is the mock's reading. */
const DISTANCE_KM: Record<DistanceOption, number | undefined> = {
  Nearby: 2, '5 km': 5, '10 km': 10, '25 km': 25, Any: undefined,
};

export const EMPTY_FILTERS: ExploreFilters = {
  categories: [], prices: [], distance: 'Any', rating: undefined, openNow: false, tags: [],
};

/** How many filters are on — the badge on the Explore filter button. */
export function activeFilterCount(f: ExploreFilters): number {
  return f.categories.length + f.prices.length + (f.distance !== 'Any' ? 1 : 0)
    + (f.rating ? 1 : 0) + (f.openNow ? 1 : 0) + f.tags.length;
}

export function toQuery(f: ExploreFilters): PlacesQuery {
  return {
    categories: f.categories,
    prices: f.prices,
    maxDistanceKm: DISTANCE_KM[f.distance],
    minRating: f.rating ? parseFloat(f.rating) : undefined,
    openNow: f.openNow || undefined,
    tags: f.tags,
  };
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const useExploreFilters = create<{
  filters: ExploreFilters;
  setFilters: (f: ExploreFilters) => void;
}>((set) => ({
  filters: EMPTY_FILTERS,
  setFilters: (filters) => set({ filters }),
}));
