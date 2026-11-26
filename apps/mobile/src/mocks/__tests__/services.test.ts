import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';

/** Loads a fresh copy of the mock layer over the SAME storage — an app restart. */
function restart(): typeof services {
  let fresh!: typeof services;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', () => AsyncStorage);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module copy is the point
    fresh = require('../services').mockServices;
  });
  return fresh;
}

beforeEach(async () => {
  simulation.latencyMs = 0;
  simulation.offline = false;
  simulation.failNext = false;
  await resetAll();
});

describe('mock auth', () => {
  it('signs a seeded user in by email', async () => {
    const session = await services.auth.signIn('khaled@example.com', 'secret1');
    expect(session.accountId).toBe('p-khaled');
    expect((await services.profile.getAccount()).firstName).toBe('Khaled');
  });

  it('logs out and leaves no readable state', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    await services.auth.signOut();
    expect(await services.auth.getSession()).toBeNull();
    await expect(services.plans.listUpcoming()).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('restores the session after a restart', async () => {
    await services.auth.signIn('omar@example.com', 'secret1');
    const after = restart();
    expect(await after.auth.getSession()).toMatchObject({ accountId: 'p-omar' });
    expect((await after.profile.getAccount()).firstName).toBe('Omar');
  });
});

describe('saved places', () => {
  it('saves and unsaves', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    await services.saved.save('myazu');
    await services.saved.save('myazu'); // idempotent
    expect((await services.saved.list()).map((s) => s.placeId)).toEqual(['myazu']);
    await services.saved.unsave('myazu');
    expect(await services.saved.list()).toEqual([]);
  });

  it('persists across a restart', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    await services.saved.save('roka');
    const after = restart();
    expect((await after.saved.list()).map((s) => s.placeId)).toEqual(['roka']);
  });

  it('keeps each account isolated', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    await services.saved.save('myazu');
    await services.auth.signIn('khaled@example.com', 'secret1');
    expect(await services.saved.list()).toEqual([]);
    await services.auth.signIn('ahmad@example.com', 'secret1');
    expect((await services.saved.list()).map((s) => s.placeId)).toEqual(['myazu']);
  });
});

describe('plan lists', () => {
  it('shows the seeded plans in board order and the finished one as past', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    const upcoming = (await services.plans.listUpcoming()).map((p) => p.title);
    expect(upcoming.slice(0, 3)).toEqual(['Friday Night', "Ahmad & Nisreen's Wedding", 'Florence']);
    const past = (await services.plans.listPast()).map((p) => p.title);
    expect(past).toContain('Padel & Dinner');
    expect(past).not.toContain('Florence');
  });

  it('moves a plan to Past once its dates go by', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    const friday = (await services.plans.listUpcoming()).find((p) => p.title === 'Friday Night')!;
    const realNow = Date.now;
    try {
      Date.now = () => Date.parse(friday.startsAt!) + 60 * 60 * 1000;
      expect((await services.plans.listUpcoming()).map((p) => p.id)).not.toContain(friday.id);
      expect((await services.plans.listPast()).map((p) => p.id)).toContain(friday.id);
    } finally {
      Date.now = realNow;
    }
  });

  it('only shows a user the plans they belong to', async () => {
    await services.auth.signIn('nisreen@example.com', 'secret1');
    const ids = (await services.plans.listUpcoming()).map((p) => p.id);
    expect(ids).toEqual(['plan-wedding']); // co-host of the wedding, nothing else
  });

  it('shows an invited guest the guest view of an event, without host-only items', async () => {
    await services.auth.signIn('khaled@example.com', 'secret1');
    const wedding = await services.plans.get('plan-wedding');
    if (wedding.type !== 'event') throw new Error('expected an event');
    expect(wedding.schedule.some((i) => i.visibility === 'hosts_only')).toBe(false);
    expect(wedding.guests.every((g) => g.personId === undefined)).toBe(true);
  });
});

describe('wedding headcount', () => {
  it('has four guests and hides host-only items from guests', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    const wedding = await services.plans.get('plan-wedding');
    expect(wedding.type).toBe('event');
    if (wedding.type !== 'event') return;
    expect(wedding.guests).toHaveLength(4);
    const projected = await services.events.guestProjection('plan-wedding');
    expect(projected.schedule.some((i) => i.visibility === 'hosts_only')).toBe(false);
  });
});

describe('reset', () => {
  it('returns everything to the seeded state and signs out', async () => {
    await services.auth.signIn('ahmad@example.com', 'secret1');
    await services.saved.save('myazu');
    await resetAll();
    expect(await services.auth.getSession()).toBeNull();
    await services.auth.signIn('ahmad@example.com', 'secret1');
    expect(await services.saved.list()).toEqual([]);
  });
});
