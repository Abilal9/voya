import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockServices as services } from '../services';
import { mergeLegacyPlans, resetAll, seedWorld, simulation } from '../store';
import { headcountLabel } from '@/services/planRules';

function restart(): typeof services {
  let fresh!: typeof services;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', () => AsyncStorage);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module copy is the point
    fresh = require('../services').mockServices;
  });
  return fresh;
}

const as = (email: string, svc: typeof services = services) => svc.auth.signIn(email, 'secret1');

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('one canonical record per plan', () => {
  it('gives two members the same plan id', async () => {
    await as('ahmad@example.com');
    const ahmads = (await services.plans.listUpcoming()).find((p) => p.title === 'Friday Night')!;
    await as('khaled@example.com');
    const khaleds = (await services.plans.listUpcoming()).find((p) => p.title === 'Friday Night')!;
    expect(khaleds.id).toBe(ahmads.id);
  });

  it('shows a change made by one member to the other', async () => {
    await as('ahmad@example.com');
    await services.hangouts.vote('plan-friday', 'sg-2', 'up');
    await as('khaled@example.com');
    const friday = await services.plans.get('plan-friday');
    if (friday.type !== 'hangout') throw new Error('expected hangout');
    expect(friday.suggestions.find((s) => s.id === 'sg-2')!.votes['p-ahmad']).toBe('up');
  });

  it('keeps a plan for everyone else when one member leaves', async () => {
    await as('omar@example.com');
    await services.plans.leave('plan-friday');
    expect((await services.plans.listUpcoming()).map((p) => p.id)).not.toContain('plan-friday');
    await as('ahmad@example.com');
    expect(headcountLabel(await services.plans.get('plan-friday'))).toBe('3 people');
  });
});

describe('isolation', () => {
  it('hides a plan from an account that is not on it, even by id', async () => {
    await as('nisreen@example.com');
    await expect(services.plans.get('plan-florence')).rejects.toMatchObject({ code: 'not_found' });
    await expect(services.hangouts.vote('plan-friday', 'sg-1', 'up')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('gives a new sign-up no inherited plans, even after others create some', async () => {
    await as('ahmad@example.com');
    await services.plans.createHangout({ title: 'Brunch', city: 'Riyadh', template: 'Dinner', startsAt: new Date(Date.now() + 86400000).toISOString() });
    await services.auth.signUp('new@example.com', 'secret12', { firstName: 'New', lastName: 'User' });
    expect(await services.plans.listUpcoming()).toEqual([]);
    expect(await services.plans.listPast()).toEqual([]);
  });

  it('does not let a guest answer for someone else', async () => {
    await as('khaled@example.com');
    await expect(services.events.setRsvp('plan-wedding', 'g-omar', 'declined')).rejects.toMatchObject({ code: 'forbidden' });
    await services.events.setRsvp('plan-wedding', 'g-khaled', 'maybe');
    await as('ahmad@example.com');
    const wedding = await services.plans.get('plan-wedding');
    if (wedding.type !== 'event') throw new Error('expected event');
    expect(wedding.guests.find((g) => g.id === 'g-khaled')!.rsvp).toBe('maybe');
  });
});

describe('persistence', () => {
  it('keeps shared changes and per-account saves across logout, login and restart', async () => {
    await as('ahmad@example.com');
    const created = await services.plans.createHangout({ title: 'Brunch', city: 'Riyadh', template: 'Dinner', startsAt: new Date(Date.now() + 86400000).toISOString() });
    await services.saved.save('myazu');
    await services.auth.signOut();
    const after = restart();
    await as('ahmad@example.com', after);
    expect((await after.plans.listUpcoming()).map((p) => p.id)).toContain(created.id);
    expect((await after.saved.list()).map((s) => s.placeId)).toEqual(['myazu']);
    await as('khaled@example.com', after);
    expect(await after.saved.list()).toEqual([]);
  });

  it('reset restores the seeded world', async () => {
    await as('ahmad@example.com');
    await services.plans.leave('plan-friday');
    await resetAll();
    await as('ahmad@example.com');
    const titles = (await services.plans.listUpcoming()).map((p) => p.title);
    expect(titles).toEqual(['Friday Night', "Ahmad & Nisreen's Wedding", 'Florence']);
  });
});

describe('migration from per-account copies', () => {
  it('adds plans the user created and keeps their newer edits', () => {
    const world = seedWorld();
    const friday = world.plans.find((p) => p.id === 'plan-friday')!;
    const edited = { ...friday, title: 'Friday Night (edited)', version: friday.version + 1 };
    const mine = { ...friday, id: 'plan-mine', title: 'Mine' };
    const stale = { ...world.plans.find((p) => p.id === 'plan-florence')!, title: 'Old', version: 0 };
    const merged = mergeLegacyPlans(world, [edited, mine, stale]);
    expect(merged.plans.find((p) => p.id === 'plan-friday')!.title).toBe('Friday Night (edited)');
    expect(merged.plans.find((p) => p.id === 'plan-florence')!.title).toBe('Florence');
    expect(merged.plans.map((p) => p.id)).toContain('plan-mine');
  });

  it('folds a stored legacy account copy into the world on first read', async () => {
    const legacy = {
      account: { id: 'p-ahmad', firstName: 'Ahmad', displayName: 'Ahmad Bilal', email: 'ahmad@example.com', onboardingStep: 'done', onboardingComplete: true, interests: [] },
      plans: [{ ...seedWorld().plans[1]!, id: 'plan-legacy', title: 'Legacy brunch' }],
      saved: [{ placeId: 'roka', savedAt: new Date().toISOString() }],
      signals: {},
      activity: [],
    };
    await AsyncStorage.setItem('voya:v2:p-ahmad:state', JSON.stringify(legacy));
    const after = restart();
    await as('ahmad@example.com', after);
    expect((await after.plans.listUpcoming()).map((p) => p.title)).toContain('Legacy brunch');
    expect((await after.saved.list()).map((s) => s.placeId)).toEqual(['roka']);
    const stored = JSON.parse((await AsyncStorage.getItem('voya:v2:p-ahmad:state'))!);
    expect(stored.plans).toBeUndefined();
  });
});
