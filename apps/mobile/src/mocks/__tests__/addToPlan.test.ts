import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';
import { hoursLine } from '@/features/explore/placeFormat';

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('add to plan', () => {
  it('offers upcoming hangouts and trips the user is on, never events', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    const targets = await services.plans.addTargets('myazu');
    expect(targets.map((t) => t.plan.title)).toEqual(['Friday Night', 'Florence']);
    expect(targets.every((t) => t.plan.type !== 'event')).toBe(true);
  });

  it('adds a hangout suggestion visible to every member, once', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    expect(await services.plans.addPlace('plan-friday', 'urth')).toEqual({ added: true });
    expect(await services.plans.addPlace('plan-friday', 'urth')).toEqual({ added: false });
    const targets = await services.plans.addTargets('urth');
    expect(targets.find((t) => t.plan.id === 'plan-friday')!.alreadyAdded).toBe(true);
    await services.auth.signIn('khaled@example.com', 'x');
    const friday = await services.plans.get('plan-friday');
    if (friday.type !== 'hangout') throw new Error('expected hangout');
    expect(friday.suggestions.filter((s) => s.placeId === 'urth')).toHaveLength(1);
  });

  it('adds a trip Must Do', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    await services.plans.addPlace('plan-florence', 'gilli');
    const florence = await services.plans.get('plan-florence');
    if (florence.type !== 'trip') throw new Error('expected trip');
    expect(florence.mustDoPlaceIds).toContain('gilli');
  });

  it('refuses plans the user is not on, and events', async () => {
    await services.auth.signIn('nisreen@example.com', 'x');
    expect(await services.plans.addTargets('myazu')).toEqual([]);
    await expect(services.plans.addPlace('plan-friday', 'myazu')).rejects.toMatchObject({ code: 'not_found' });
    await expect(services.plans.addPlace('plan-wedding', 'myazu')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('refuses unknown places', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    await expect(services.plans.addPlace('plan-friday', 'nope')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('place details data', () => {
  it('never turns unknown hours into closed', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    expect(hoursLine(await services.places.getPlace('somewhere'))).toBe('Hours unknown');
    expect(hoursLine(await services.places.getPlace('myazu'))).toBe('Open until 12:00 AM');
    expect(hoursLine(await services.places.getPlace('closed-cafe'))).toBe('Permanently closed');
    expect(hoursLine(await services.places.getPlace('finzione'))).toBe('Opens at 6:00 PM');
  });

  it('reports a missing place as not found', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    await expect(services.places.getPlace('nope')).rejects.toMatchObject({ code: 'not_found' });
  });
});
