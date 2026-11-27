import type { ApiClient, Method } from '../http';
import { createRealPlanServices } from '../plans';
import { ServiceError } from '@/services/types';

/**
 * The real plan provider against a scripted API: what it sends (paths,
 * bodies, If-Match), what it refuses without sending anything, and how it
 * maps answers onto the frozen app's service contracts.
 */

const ME = '00000000-0000-4000-8000-0000000000a1';
const PLAN = '00000000-0000-4000-8000-0000000000f1';

const hangout = (version: number, extra: Record<string, unknown> = {}) => ({
  id: PLAN, type: 'hangout', title: 'Friday', city: 'Riyadh', lifecycle: 'active', ownerId: ME, version,
  members: [{ personId: ME, role: 'organizer', capabilities: ['plan.edit'], joinedAt: '2030-01-01T00:00:00.000Z' }],
  startsAt: '2030-01-03T18:00:00.000Z', template: 'Dinner', suggestions: [], finalized: false, timeline: [], invites: [],
  ...extra,
});
const event = (version: number) => ({
  id: PLAN, type: 'event', title: 'Wedding', city: 'Riyadh', lifecycle: 'active', ownerId: ME, version,
  members: [{ personId: ME, role: 'host', capabilities: ['plan.edit'], joinedAt: '2030-01-01T00:00:00.000Z' }],
  startsAt: '2030-01-03T19:00:00.000Z', venue: 'Hall', schedule: [],
  guests: [
    { id: 'g1', personId: '00000000-0000-4000-8000-0000000000b1', displayName: 'Khaled', rsvp: 'going' },
    { id: 'g2', displayName: 'Aunt Huda', rsvp: 'pending' },
  ],
});

interface Call { method: Method; path: string; body?: unknown; headers?: Record<string, string> }

function scriptedApi(answer: (call: Call) => unknown) {
  const calls: Call[] = [];
  const api: ApiClient = {
    async call(method, path, schema, body, headers) {
      const c = { method, path, body, headers };
      calls.push(c);
      const raw = answer(c);
      if (raw instanceof Error) throw raw;
      return schema ? schema.parse(raw) : (undefined as never);
    },
  };
  return { api, calls };
}

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof ServiceError ? e.code : 'other';
  }
};

it('reads plans from the API, never from the phone', async () => {
  const { api, calls } = scriptedApi(() => ({ items: [hangout(2)] }));
  const real = createRealPlanServices(api);
  expect((await real.plans.listUpcoming()).map((p) => p.id)).toEqual([PLAN]);
  await real.plans.listPast();
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /plans?timing=upcoming', 'GET /plans?timing=past']);
});

it('sends the version this phone last saw, and lets a stale edit fail as a conflict', async () => {
  let version = 3;
  const { api, calls } = scriptedApi((c) => {
    if (c.method === 'GET') return hangout(version);
    if (c.headers?.['if-match'] !== String(version)) return new ServiceError('conflict', 'This plan changed since you opened it.', false);
    version += 1;
    return hangout(version, { title: (c.body as { title: string }).title });
  });
  const real = createRealPlanServices(api);
  // Never seen: fetches first so the edit is against a real version.
  expect((await real.hangouts.update(PLAN, { title: 'Dinner' })).title).toBe('Dinner');
  expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH']);
  expect(calls[1]).toMatchObject({ path: `/plans/${PLAN}`, headers: { 'if-match': '3' }, body: { title: 'Dinner' } });

  version = 9; // someone else saved in between
  expect(await codeOf(real.hangouts.update(PLAN, { title: 'Late' }))).toBe('conflict');
  expect(calls.at(-1)?.headers).toEqual({ 'if-match': '4' });
});

it('refuses experience actions that are not shared yet, without touching the API or the phone', async () => {
  const { api, calls } = scriptedApi(() => new Error('should not be called'));
  const real = createRealPlanServices(api);
  for (const attempt of [
    real.hangouts.vote(PLAN, 's', 'up'),
    real.hangouts.finalize(PLAN),
    real.events.saveSchedule(PLAN, [], 1),
    real.events.addCohosts(PLAN, []),
    real.trips.generateItinerary(PLAN),
    real.trips.pick(PLAN, 'x', 'like'),
    real.plans.addPlace(PLAN, 'x'),
    real.plans.createEvent({ title: 'W', venue: 'Hall', startsAt: '2030-01-01T18:00:00.000Z', coverUri: 'file:///cover.jpg' }),
  ]) {
    expect(await codeOf(attempt)).toBe('not_available');
  }
  expect(calls).toHaveLength(0);
});

it('maps answers to invitations, and keeps the screen’s plan when a decline hides it', async () => {
  const { api, calls } = scriptedApi((c) => (c.method === 'GET' ? hangout(1) : { plan: null }));
  const real = createRealPlanServices(api);
  await real.plans.get(PLAN);
  const after = await real.hangouts.respond(PLAN, 'declined');
  expect(after.id).toBe(PLAN);
  expect(calls[1]).toMatchObject({ method: 'POST', path: `/plans/${PLAN}/response`, body: { answer: 'decline' } });
  // Forgotten: a later edit has to fetch again.
  expect(await codeOf(real.hangouts.respond(PLAN, 'in'))).toBe('not_found');
});

it('removes an event guest who is on Voya by person; name-only guests are not shared yet', async () => {
  const { api, calls } = scriptedApi((c) => event(c.method === 'GET' ? 1 : 2));
  const real = createRealPlanServices(api);
  await real.plans.get(PLAN);
  await real.events.removeGuest(PLAN, 'g1');
  expect(calls[1]).toMatchObject({ method: 'DELETE', path: `/plans/${PLAN}/people/00000000-0000-4000-8000-0000000000b1`, headers: { 'if-match': '1' } });
  expect(await codeOf(real.events.removeGuest(PLAN, 'g2'))).toBe('not_available');
});

it('lets an event end after midnight, as the form means it', async () => {
  const { api, calls } = scriptedApi((c) => event(c.method === 'GET' ? 1 : 2));
  const real = createRealPlanServices(api);
  await real.plans.get(PLAN);
  await real.events.update(PLAN, { endsAt: '2030-01-03T01:00:00.000Z' });
  expect(calls[1]?.body).toEqual({ endsAt: '2030-01-04T01:00:00.000Z' });
});

it('reports a bad invitation link as invalid, and expired/revoked as themselves', async () => {
  const { api } = scriptedApi((c) =>
    c.path === '/invitations/resolve' ? new ServiceError('not_found', 'This invitation was not found.', false) : new ServiceError('expired', 'This invitation has expired.', false),
  );
  const real = createRealPlanServices(api);
  expect(await codeOf(real.invitations.resolve('x'.repeat(43)))).toBe('invalid_invite');
  expect(await codeOf(real.invitations.accept('x'.repeat(43)))).toBe('expired');
});

it('keeps per-plan mutes on the server, changing only what changed', async () => {
  let muted = ['a', 'b'];
  const { api, calls } = scriptedApi((c) => {
    if (c.method === 'PUT') {
      const id = c.path.split('/')[2]!;
      muted = (c.body as { muted: boolean }).muted ? [...muted, id] : muted.filter((m) => m !== id);
      return undefined;
    }
    return { planIds: muted };
  });
  const real = createRealPlanServices(api);
  expect(await real.setMutedPlans(['b', 'c'])).toEqual(['b', 'c']);
  expect(calls.filter((c) => c.method === 'PUT').map((c) => [c.path, c.body])).toEqual([
    ['/plans/a/mute', { muted: false }],
    ['/plans/c/mute', { muted: true }],
  ]);
});

it('forgets what one account saw when the account changes', async () => {
  const { api, calls } = scriptedApi((c) => hangout(c.method === 'GET' ? 1 : 2));
  const real = createRealPlanServices(api);
  await real.plans.get(PLAN);
  real.reset();
  await real.hangouts.update(PLAN, { title: 'x' });
  expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'PATCH']);
});
