import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';
import { EMPTY_FILTERS, activeFilterCount, toQuery } from '@/features/explore/filters';

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
  await services.auth.signIn('ahmad@example.com', 'x');
});

const names = (ps: { name: string }[]) => ps.map((p) => p.name);

describe('search', () => {
  it('matches every word across name, type and category', async () => {
    const hits = await services.places.search({ query: 'Japanese food', city: 'Riyadh' });
    expect(names(hits)).toContain('Myazu');
    expect(hits.every((p) => p.city === 'Riyadh')).toBe(true);
  });

  it('returns nothing for an empty query or no match', async () => {
    expect(await services.places.search({ query: '   ', city: 'Riyadh' })).toEqual([]);
    expect(await services.places.search({ query: 'late-night pottery', city: 'Riyadh' })).toEqual([]);
  });

  it('never returns permanently closed places', async () => {
    const all = await services.places.search({ query: 'a' });
    expect(all.some((p) => p.permanentlyClosed)).toBe(false);
  });

  it('remembers recent searches, newest first, without duplicates, at most five', async () => {
    expect(await services.places.recentSearches()).toEqual(['Myazu', 'Coffee', 'Padel']);
    for (const q of ['Museums', 'coffee', 'A', 'B', 'C']) await services.places.rememberSearch(q);
    expect(await services.places.recentSearches()).toEqual(['C', 'B', 'A', 'coffee', 'Museums']);
  });

  it('keeps recent searches per account', async () => {
    await services.places.rememberSearch('Padel courts');
    await services.auth.signIn('khaled@example.com', 'x');
    expect(await services.places.recentSearches()).toEqual([]);
  });
});

describe('filters', () => {
  it('applies price, rating and open-now together', async () => {
    const hits = await services.places.discover({
      city: 'Riyadh', ...toQuery({ ...EMPTY_FILTERS, prices: ['$$'], rating: '4.5+', openNow: true }),
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((p) => p.price === '$$' && (p.rating ?? 0) >= 4.5 && p.openNow === true)).toBe(true);
  });

  it('treats unknown hours as not open now, and missing ratings as below any minimum', async () => {
    const open = await services.places.discover({ city: 'Riyadh', openNow: true });
    expect(open.every((p) => p.openNow === true)).toBe(true);
    const rated = await services.places.discover({ city: 'Riyadh', minRating: 4 });
    expect(rated.every((p) => p.rating !== undefined)).toBe(true);
  });

  it('matches any of several categories', async () => {
    const hits = await services.places.discover({ city: 'Riyadh', categories: ['Coffee', 'Dessert'] });
    expect(new Set(hits.map((p) => p.category))).toEqual(new Set(['Coffee', 'Dessert']));
  });

  it('limits by distance from the city centre and drops places with no location', async () => {
    const near = await services.places.discover({ city: 'Riyadh', ...toQuery({ ...EMPTY_FILTERS, distance: '5 km' }) });
    expect(near.every((p) => (services.places.distanceKm(p) ?? Infinity) <= 5)).toBe(true);
    const any = await services.places.discover({ city: 'Riyadh' });
    expect(any.length).toBeGreaterThanOrEqual(near.length);
  });

  it('counts active filters for the badge', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, categories: ['Food'], prices: ['$', '$$'], distance: 'Nearby', openNow: true })).toBe(5);
  });
});
