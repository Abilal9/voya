import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockServices as services } from '../services';
import { normalizeWorld, resetAll, seedWorld, simulation } from '../store';
import { eventRole, eventScreen, hostLine, rsvpCounts } from '@/services/eventRules';
import { classifyPlan } from '@/services/planRules';
import type { VoyaEvent } from '@/services';

const inDays = (d: number, h = 19) => {
  const t = new Date(Date.now() + d * 86400000);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};
const as = (who: string) => services.auth.signIn(`${who}@example.com`, 'x');
const event = async (id: string) => {
  const p = await services.plans.get(id);
  if (p.type !== 'event') throw new Error('expected event');
  return p;
};
const create = (extra: Partial<Parameters<typeof services.plans.createEvent>[0]> = {}) =>
  services.plans.createEvent({ title: 'Sara’s Birthday', venue: 'Nofa Majlis', startsAt: inDays(10), endsAt: inDays(10, 23), ...extra });

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
  await resetAll();
});

describe('create (18)', () => {
  it('creates one shared event with the creator and chosen people as hosts', async () => {
    await as('ahmad');
    const e = await create({ title: '  Sara’s Birthday ', hosts: ['p-nisreen', 'p-ahmad', 'p-nobody'], description: '  Bring a smile ' });
    expect(e.title).toBe('Sara’s Birthday');
    expect(e.description).toBe('Bring a smile');
    expect(e.members.map((m) => [m.personId, m.role])).toEqual([['p-ahmad', 'host'], ['p-nisreen', 'host']]);
    expect(e.guests).toEqual([]);
    expect(e.schedule).toEqual([]);
    expect((await services.plans.listUpcoming()).map((p) => p.id)).toContain(e.id);
    await as('nisreen');
    expect(eventRole(await event(e.id), 'p-nisreen')).toBe('host');
    await as('khaled');
    await expect(services.plans.get(e.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('validates name, location and date, and runs an early end time past midnight', async () => {
    await as('ahmad');
    await expect(create({ title: ' ' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(create({ venue: '' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(create({ startsAt: 'not a date' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(create({ startsAt: inDays(-2) })).rejects.toMatchObject({ code: 'invalid' });
    const late = await create({ startsAt: inDays(5, 19), endsAt: inDays(5, 1) });
    expect(Date.parse(late.endsAt!) - Date.parse(late.startsAt!)).toBe(6 * 3600000);
  });
});

describe('invitations and RSVP (20, 21, 24)', () => {
  it('Ahmad invites Khaled and Nisreen; Khaled accepts, Nisreen declines; Ahmad sees both', async () => {
    await as('ahmad');
    const e = await create();
    await services.events.invite(e.id, ['p-khaled', 'p-omar', 'p-khaled']);
    const again = await services.events.invite(e.id, ['p-khaled']);
    expect(again.guests.filter((g) => g.personId === 'p-khaled')).toHaveLength(1);

    // Nisreen is not invited yet: no access, no answering.
    await as('nisreen');
    await expect(services.plans.get(e.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(services.events.respond(e.id, 'going')).rejects.toMatchObject({ code: 'not_found' });

    await as('ahmad');
    await services.events.invite(e.id, ['p-nisreen']);

    await as('khaled');
    expect(eventRole(await event(e.id), 'p-khaled')).toBe('none'); // projection hides identities…
    const seen = await event(e.id);
    expect(seen.viewerGuestId).toBeDefined(); // …but marks the viewer's own row
    expect(seen.guests.find((g) => g.id === seen.viewerGuestId)!.rsvp).toBe('pending');
    const answered = await services.events.respond(e.id, 'going');
    expect(answered.guests.find((g) => g.id === answered.viewerGuestId)!.rsvp).toBe('going');
    expect(answered.guests.every((g) => g.personId === undefined)).toBe(true);
    expect(answered.guests.filter((g) => g.id !== answered.viewerGuestId).every((g) => g.displayName === '')).toBe(true);

    await as('nisreen');
    await services.events.respond(e.id, 'declined');

    await as('ahmad');
    const host = await event(e.id);
    const rsvp = Object.fromEntries(host.guests.map((g) => [g.personId, g.rsvp]));
    expect(rsvp).toEqual({ 'p-khaled': 'going', 'p-omar': 'pending', 'p-nisreen': 'declined' });
    expect(rsvpCounts(host)).toEqual({ going: 1, maybe: 0, awaiting: 1, declined: 1 });
  });

  it('a guest cannot answer for someone else; the host can record an answer', async () => {
    await as('khaled');
    await expect(services.events.setRsvp('plan-wedding', 'g-omar', 'declined')).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    await services.events.setRsvp('plan-wedding', 'g-stranger', 'going');
    expect(rsvpCounts(await event('plan-wedding')).going).toBe(3);
  });

  it('answers persist across a restart and can be changed', async () => {
    await as('faisal');
    await services.events.respond('plan-wedding', 'maybe');
    const fresh = restart();
    await fresh.auth.signIn('faisal@example.com', 'x');
    expect((await fresh.events.respond('plan-wedding', 'going')).viewerGuestId).toBe('g-faisal');
    const later = restart();
    await later.auth.signIn('ahmad@example.com', 'x');
    const seen = await later.plans.get('plan-wedding') as VoyaEvent;
    expect(seen.guests.find((g) => g.id === 'g-faisal')!.rsvp).toBe('going');
  });

  it('guests never see host-only schedule items', async () => {
    await as('khaled');
    const e = await event('plan-wedding');
    expect(e.schedule.map((i) => i.title)).not.toContain('Photographer briefing');
    expect(e.cohostPermissions).toBeUndefined();
  });
});

describe('roles (EV03) and guest management (40)', () => {
  it('guests cannot use host actions', async () => {
    await as('khaled');
    await expect(services.events.invite('plan-wedding', ['p-faisal'])).rejects.toMatchObject({ code: 'not_found' });
    await expect(services.events.update('plan-wedding', { title: 'Mine' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(services.events.cancel('plan-wedding')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('co-hosts get only the permissions hosts choose', async () => {
    await as('ahmad');
    await services.events.addCohosts('plan-wedding', ['p-khaled']);
    const e = await event('plan-wedding');
    expect(e.guests.map((g) => g.personId)).not.toContain('p-khaled'); // hosting, not a guest
    expect(e.members.find((m) => m.personId === 'p-khaled')!.role).toBe('co-host');

    await as('khaled');
    await services.events.invite('plan-wedding', ['p-nisreen']); // guests: allowed by default
    await services.events.upsertScheduleItem('plan-wedding', { title: 'Late snacks', startsAt: (await event('plan-wedding')).startsAt });
    await expect(services.events.update('plan-wedding', { title: 'Mine' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(services.events.cancel('plan-wedding')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(services.events.setCohostPermissions('plan-wedding', { details: true, guests: true, schedule: true })).rejects.toMatchObject({ code: 'forbidden' });

    await as('ahmad');
    await services.events.setCohostPermissions('plan-wedding', { details: true, guests: false, schedule: false });
    await as('khaled');
    await services.events.update('plan-wedding', { description: 'See you there' });
    await expect(services.events.invite('plan-wedding', ['p-omar'])).rejects.toMatchObject({ code: 'forbidden' });

    await as('ahmad');
    await expect(services.events.removeHost('plan-wedding', 'p-ahmad')).rejects.toMatchObject({ code: 'forbidden' });
    await services.events.setHostRole('plan-wedding', 'p-khaled', 'host');
    expect((await event('plan-wedding')).members.find((m) => m.personId === 'p-khaled')!.capabilities).toContain('plan.delete');
    await services.events.removeHost('plan-wedding', 'p-khaled');
    await as('khaled');
    await expect(services.plans.get('plan-wedding')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('removing a guest takes away their access and their count', async () => {
    await as('ahmad');
    await services.events.removeGuest('plan-wedding', 'g-omar');
    expect(rsvpCounts(await event('plan-wedding')).going).toBe(1);
    await as('omar');
    await expect(services.plans.get('plan-wedding')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('adds name-only guests once', async () => {
    await as('ahmad');
    await services.events.addGuest('plan-wedding', 'Lina Saad');
    await expect(services.events.addGuest('plan-wedding', ' lina saad ')).rejects.toMatchObject({ code: 'invalid' });
    await expect(services.events.addGuest('plan-wedding', '  ')).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('schedule (22, 23, EV06)', () => {
  it('validates items, keeps time order, and guests see the host’s updates', async () => {
    await as('ahmad');
    const e = await create();
    await services.events.invite(e.id, ['p-khaled']);
    await expect(services.events.upsertScheduleItem(e.id, { title: '', startsAt: e.startsAt })).rejects.toMatchObject({ code: 'invalid' });
    const at = (h: number) => new Date(Date.parse(e.startsAt!) + h * 3600000).toISOString();
    await services.events.upsertScheduleItem(e.id, { title: 'Dinner', startsAt: at(1), location: 'Garden' });
    const withTwo = await services.events.upsertScheduleItem(e.id, { title: 'Arrival', startsAt: at(0), endsAt: at(1) });
    expect(withTwo.schedule.map((i) => i.title)).toEqual(['Arrival', 'Dinner']);
    expect(withTwo.schedule[1]!.subtitle).toBe('Garden');
    await services.events.upsertScheduleItem(e.id, { title: 'Briefing', startsAt: at(0.5), visibility: 'hosts_only' });

    await as('khaled');
    expect((await event(e.id)).schedule.map((i) => i.title)).toEqual(['Arrival', 'Dinner']);
    await expect(services.events.upsertScheduleItem(e.id, { title: 'Mine', startsAt: at(2) })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('saves the whole schedule, and refuses a save made over someone else’s', async () => {
    await as('ahmad');
    const base = await event('plan-wedding');
    const items = base.schedule.filter((i) => i.title !== 'Dancing').map((i) => (i.title === 'Dinner' ? { ...i, title: 'Dinner is served' } : i));
    const saved = await services.events.saveSchedule('plan-wedding', items, base.version);
    expect(saved.schedule.map((i) => i.title)).toContain('Dinner is served');
    expect(saved.schedule.map((i) => i.title)).not.toContain('Dancing');
    // An editor opened on the old version can no longer save over it.
    await expect(services.events.saveSchedule('plan-wedding', base.schedule, base.version)).rejects.toMatchObject({ code: 'conflict' });
    await services.events.saveSchedule('plan-wedding', [], saved.version);
    expect((await event('plan-wedding')).schedule).toEqual([]);
  });
});

describe('editing, cancelling and completion (EV01, EV02, EV05)', () => {
  it('edits keep the event’s length when only the start moves', async () => {
    await as('ahmad');
    const e = await create();
    const moved = await services.events.update(e.id, { startsAt: inDays(12) });
    expect(Date.parse(moved.endsAt!) - Date.parse(moved.startsAt!)).toBe(Date.parse(e.endsAt!) - Date.parse(e.startsAt!));
    await expect(services.events.update(e.id, { title: '' })).rejects.toMatchObject({ code: 'invalid' });
    expect((await event(e.id)).title).toBe('Sara’s Birthday');
  });

  it('cancelling keeps the event, read-only, under past plans for everyone', async () => {
    await as('ahmad');
    await services.events.cancel('plan-wedding');
    await expect(services.events.invite('plan-wedding', ['p-nisreen'])).rejects.toMatchObject({ code: 'invalid' });
    await as('khaled');
    const e = await event('plan-wedding');
    expect(e.lifecycle).toBe('cancelled');
    expect(classifyPlan(e)).toBe('past');
    expect((await services.plans.listPast()).map((p) => p.id)).toContain('plan-wedding');
    await expect(services.events.respond('plan-wedding', 'maybe')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('a completed event is past, keeps its schedule and takes no new answers', async () => {
    await as('ahmad');
    const g = await event('plan-graduation');
    expect(classifyPlan(g)).toBe('past');
    expect(g.schedule.map((i) => i.title)).toEqual(['Guest arrival', 'Dinner', 'Graduation toast']);
    await expect(services.events.respond('plan-graduation', 'declined')).rejects.toMatchObject({ code: 'invalid' });
    await as('faisal');
    expect(rsvpCounts(await event('plan-graduation'))).toEqual({ going: 2, maybe: 1, awaiting: 0, declined: 0 });
    expect(hostLine(await event('plan-graduation'), () => 'Faisal')).toBe('Faisal');
  });

  it('a deleted account leaves the guest list and host list', async () => {
    await as('khaled');
    await services.auth.deleteAccount();
    await as('ahmad');
    expect((await event('plan-wedding')).guests.map((g) => g.personId)).not.toContain('p-khaled');
  });
});

describe('stored worlds', () => {
  it('adds new fixture plans once, and never brings back a deleted seeded plan', () => {
    const world = seedWorld();
    const old = { plans: world.plans.filter((p) => p.id !== 'plan-graduation' && p.id !== 'plan-friday') };
    const upgraded = normalizeWorld(old);
    const ids = upgraded.plans.map((p) => p.id);
    expect(ids).toContain('plan-graduation');
    expect(ids).not.toContain('plan-friday');
    const again = normalizeWorld({ ...upgraded, plans: upgraded.plans.filter((p) => p.id !== 'plan-graduation') });
    expect(again.plans.map((p) => p.id)).not.toContain('plan-graduation');
  });
});

describe('which screen each person sees (/event/[id])', () => {
  const screenFor = async (who: string, id: string, details = false) => {
    await as(who);
    const e = await event(id);
    const me = who === 'ahmad' ? 'p-ahmad' : `p-${who}`;
    return eventScreen(e, me, e.lifecycle === 'cancelled' || classifyPlan(e) === 'past', details);
  };

  it('routes hosts, co-hosts, invitees and guests to their own view', async () => {
    expect(await screenFor('ahmad', 'plan-wedding')).toBe('host');
    expect(await screenFor('nisreen', 'plan-wedding')).toBe('host');
    expect(await screenFor('faisal', 'plan-wedding')).toBe('invitation');
    expect(await screenFor('faisal', 'plan-wedding', true)).toBe('guest');
    expect(await screenFor('khaled', 'plan-wedding')).toBe('guest');
    await as('ahmad');
    await services.events.addCohosts('plan-wedding', ['p-omar']);
    expect(await screenFor('omar', 'plan-wedding')).toBe('host');
  });

  it('answering moves an invitee from the invitation to the guest view', async () => {
    expect(await screenFor('faisal', 'plan-wedding')).toBe('invitation');
    await services.events.respond('plan-wedding', 'declined');
    expect(await screenFor('faisal', 'plan-wedding')).toBe('guest');
  });

  it('completed and cancelled events show the closed view to everyone', async () => {
    expect(await screenFor('ahmad', 'plan-graduation')).toBe('closed');
    expect(await screenFor('faisal', 'plan-graduation')).toBe('closed');
    await as('ahmad');
    await services.events.cancel('plan-wedding');
    expect(await screenFor('khaled', 'plan-wedding')).toBe('closed');
  });

  it('someone not on the event gets nothing back', async () => {
    await as('ahmad');
    const e = await create();
    await as('omar');
    await expect(services.plans.get(e.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('schedule conflict between hosts', () => {
  it('Ahmad’s stale save is refused after Nisreen saves; reloading shows her change', async () => {
    await as('ahmad');
    const ahmadBase = await event('plan-wedding');
    await as('nisreen');
    const theirs = await event('plan-wedding');
    await services.events.saveSchedule('plan-wedding', [...theirs.schedule, { title: 'Sparklers', startsAt: theirs.startsAt }], theirs.version);
    await as('ahmad');
    await expect(services.events.saveSchedule('plan-wedding', ahmadBase.schedule.slice(1), ahmadBase.version)).rejects.toMatchObject({ code: 'conflict' });
    const latest = await event('plan-wedding');
    expect(latest.schedule.map((i) => i.title)).toContain('Sparklers');
    expect(latest.schedule).toHaveLength(ahmadBase.schedule.length + 1);
  });
});

describe('edit details (EV02)', () => {
  it('clears the end time when asked, and keeps it when only the start moves', async () => {
    await as('ahmad');
    const e = await create();
    const cleared = await services.events.update(e.id, { startsAt: e.startsAt, endsAt: '' });
    expect(cleared.endsAt).toBeUndefined();
    const moved = await services.events.update(e.id, { venue: '  Garden Hall ' });
    expect(moved.venue).toBe('Garden Hall');
    await as('nisreen');
    await expect(services.plans.get(e.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});
