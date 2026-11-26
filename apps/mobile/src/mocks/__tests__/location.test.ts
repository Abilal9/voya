import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
  await services.auth.signIn('ahmad@example.com', 'x');
});

describe('explore city', () => {
  it('starts near me with the board recent destinations', async () => {
    expect(await services.places.exploreCity()).toBeUndefined();
    expect(await services.places.recentCities()).toEqual(['Dubai', 'Florence', 'London']);
  });

  it('switching city changes the places, not just the label', async () => {
    await services.places.chooseCity('Florence');
    const city = await services.places.exploreCity();
    expect(city).toBe('Florence');
    const places = await services.places.discover({ city });
    expect(places.length).toBeGreaterThan(0);
    expect(places.every((p) => p.city === 'Florence')).toBe(true);
    const hits = await services.places.search({ query: 'coffee', city });
    expect(hits.map((p) => p.name)).toEqual(['Caffè Gilli']);
  });

  it('a city without fixture places is allowed and simply empty', async () => {
    await services.places.chooseCity('Tokyo');
    expect(await services.places.discover({ city: 'Tokyo' })).toEqual([]);
  });

  it('records recents, newest first, three at most, and near me clears the choice', async () => {
    await services.places.chooseCity('Tokyo');
    await services.places.chooseCity('Florence');
    expect(await services.places.recentCities()).toEqual(['Florence', 'Tokyo', 'Dubai']);
    await services.places.chooseCity(null);
    expect(await services.places.exploreCity()).toBeUndefined();
  });

  it('rejects unknown cities and keeps the choice per account', async () => {
    await expect(services.places.chooseCity('Atlantis')).rejects.toMatchObject({ code: 'not_found' });
    await services.places.chooseCity('Dubai');
    await services.auth.signIn('khaled@example.com', 'x');
    expect(await services.places.exploreCity()).toBeUndefined();
    await services.auth.signIn('ahmad@example.com', 'x');
    expect(await services.places.exploreCity()).toBe('Dubai');
  });
});
