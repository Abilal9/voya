import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockServices as services } from '../services';
import { normalizeWorld, resetAll, seedWorld, simulation } from '../store';
import * as fx from '../fixtures';
import {
  buildItinerary, dateRange, groupMatches, hhmm, interestedIn, localDate, plannedDates, readyCount, todayOn, travelerStatus,
  monthWeeks,
} from '@/services/tripRules';
import { classifyPlan } from '@/services/planRules';
import type { Trip } from '@/services';

const as = (who: string) => services.auth.signIn(`${who}@example.com`, 'x');
const trip = async (id: string) => {
  const p = await services.plans.get(id);
  if (p.type !== 'trip') throw new Error('expected trip');
  return p;
};
const inDays = (n: number) => localDate(new Date(Date.now() + n * 86400000));
const create = (extra: Partial<Parameters<typeof services.trips.create>[0]> = {}) =>
  services.trips.create({ destination: 'Florence', startDate: inDays(20), endDate: inDays(24), ...extra });

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

describe('dates', () => {
  it('plans one day per night, from date-only values', () => {
    expect(plannedDates('2026-11-18', '2026-11-22')).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
    expect(plannedDates('2026-03-28', '2026-03-31')).toHaveLength(3); // across a DST change in Europe
    expect(plannedDates('2026-11-18', '2026-11-18')).toEqual(['2026-11-18']);
    expect(dateRange('2026-11-18', '2026-11-22')).toMatch(/18.22 November/);
  });
});

describe('create (03, 04)', () => {
  it('creates one shared trip with the creator as organizer, on Home', async () => {
    await as('ahmad');
    const t = await create();
    expect(t.title).toBe('Florence');
    expect(t.members.map((m) => [m.personId, m.role])).toEqual([['p-ahmad', 'organizer']]);
    expect(t.startDate).toBe(inDays(20));
    expect(plannedDates(t.startDate, t.endDate)).toHaveLength(4);
    expect((await services.plans.listUpcoming()).map((p) => p.id)).toContain(t.id);
    const fresh = restart();
    await fresh.auth.signIn('ahmad@example.com', 'x');
    expect((await fresh.plans.get(t.id)).title).toBe('Florence');
  });

  it('rejects a missing destination, bad or past dates, and a range that ends first', async () => {
    await as('ahmad');
    await expect(create({ destination: 'Atlantis' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(create({ startDate: 'soon' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(create({ startDate: inDays(-3), endDate: inDays(2) })).rejects.toMatchObject({ code: 'invalid' });
    await expect(create({ startDate: inDays(10), endDate: inDays(8) })).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('travelers (05, 12, T03)', () => {
  it('Khaled joins, Omar declines: only Khaled travels, and only invitees see the invitation', async () => {
    await as('ahmad');
    const t = await create();
    await services.trips.invite(t.id, ['p-khaled', 'p-omar', 'p-faisal', 'p-khaled']);
    await as('nisreen');
    await expect(services.plans.get(t.id)).rejects.toMatchObject({ code: 'not_found' });
    await as('khaled');
    await services.trips.respond(t.id, 'join');
    await expect(services.trips.respond(t.id, 'join')).rejects.toMatchObject({ code: 'not_found' });
    await as('omar');
    await services.trips.respond(t.id, 'decline');
    await expect(services.plans.get(t.id)).rejects.toMatchObject({ code: 'not_found' });
    await as('ahmad');
    const seen = await trip(t.id);
    expect(seen.members.map((m) => m.personId)).toEqual(['p-ahmad', 'p-khaled']);
    expect(travelerStatus(seen, 'p-omar')).toBe('declined');
    expect(travelerStatus(seen, 'p-faisal')).toBe('invited');
    expect(travelerStatus(seen, 'p-khaled')).toBe('joined');
  });

  it('only the organizer manages travelers; the organizer role can be handed over', async () => {
    await as('khaled');
    await expect(services.trips.invite('plan-florence', ['p-nisreen'])).rejects.toMatchObject({ code: 'forbidden' });
    await expect(services.trips.removeTraveler('plan-florence', 'p-omar')).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    await services.trips.removeTraveler('plan-florence', 'p-omar');
    await services.trips.makeOrganizer('plan-florence', 'p-khaled');
    await expect(services.trips.invite('plan-florence', ['p-nisreen'])).rejects.toMatchObject({ code: 'forbidden' });
    await as('khaled');
    const t = await trip('plan-florence');
    expect(t.ownerId).toBe('p-khaled');
    expect(t.picks?.['p-omar']).toBeUndefined();
  });

  it('leaving keeps the trip for everyone else and takes your choices with you', async () => {
    await as('khaled');
    await services.plans.leave('plan-florence');
    await as('ahmad');
    const t = await trip('plan-florence');
    expect(t.members.map((m) => m.personId)).not.toContain('p-khaled');
    expect(t.mustDoBy?.duomo).toBeUndefined();
    expect(t.mustDoPlaceIds).not.toContain('duomo');
  });
});

describe('preferences and must-dos (06, 07, E09)', () => {
  it('trip preferences are per traveler and never touch the account', async () => {
    await as('ahmad');
    const before = (await services.profile.getAccount()).interests;
    const t = await create();
    await services.trips.setPreferences(t.id, { interests: ['Food', 'Nature', 'Not a thing'], pace: 'Relaxed', discoveries: 'Hidden gems' });
    const after = await trip(t.id);
    expect(after.preferences?.['p-ahmad']?.interests).toEqual(['Food', 'Nature']);
    expect((await services.profile.getAccount()).interests).toEqual(before);
  });

  it('a must-do from Explore and one from the trip land in the same list, attributed, once', async () => {
    await as('khaled');
    await services.plans.addPlace('plan-florence', 'boboli'); // Explore → Add to Plan
    expect((await services.plans.addPlace('plan-florence', 'boboli')).added).toBe(false);
    await services.trips.pick('plan-florence', 'accademia', 'must'); // 07
    await as('ahmad');
    const t = await trip('plan-florence');
    expect(t.mustDoPlaceIds.filter((p) => p === 'boboli')).toHaveLength(1);
    expect(t.mustDoBy?.boboli).toEqual(['p-khaled']);
    expect(t.mustDoBy?.accademia).toEqual(['p-khaled']);
    await as('khaled');
    await services.trips.pick('plan-florence', 'accademia', 'like');
    expect((await trip('plan-florence')).mustDoPlaceIds).not.toContain('accademia');
  });

  it('readiness and early matches come from what travelers actually chose', async () => {
    await as('ahmad');
    const t = await trip('plan-florence');
    expect(readyCount(t)).toBe(3);
    expect(travelerStatus(t, 'p-omar')).toBe('choosing');
    const matches = groupMatches(t, fx.places);
    expect(matches[0]).toMatchObject({ place: expect.objectContaining({ id: 'mercato' }), interested: 4 });
    expect(interestedIn(t, 'uffizi')).toHaveLength(3);
    await as('omar');
    await services.trips.finishChoosing('plan-florence');
    expect(readyCount(await trip('plan-florence'))).toBe(4);
  });
});

describe('generation (08, 09)', () => {
  it('is deterministic, uses the trip dates and the destination, and never repeats a place', () => {
    const t = { ...fx.florenceTrip, days: [], generated: false } as Trip;
    let n = 0;
    const a = buildItinerary(t, fx.places, () => `x${n++}`);
    n = 0;
    const b = buildItinerary(t, fx.places, () => `x${n++}`);
    expect(a).toEqual(b);
    expect(a.map((d) => d.date)).toEqual(plannedDates(t.startDate, t.endDate));
    const ids = a.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean));
    expect(new Set(ids).size).toBe(ids.length);
    const florence = new Set(fx.places.filter((p) => p.city === 'Florence').map((p) => p.id));
    expect(ids.every((id) => florence.has(id!))).toBe(true);
    expect(ids).toEqual(expect.arrayContaining(['uffizi', 'duomo'])); // must-dos first
    expect(hhmm(a[0]!.items[0]!.startsAt)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('only the organizer builds; repeated taps do not rebuild; locked stops survive a rebuild', async () => {
    await as('khaled');
    await expect(services.trips.generateItinerary('plan-florence', { rebuild: true })).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    const first = await services.trips.generateItinerary('plan-florence');
    expect(first.days[0]!.items.map((i) => i.id)).toContain('it-1'); // already built: kept as is
    const rebuilt = await services.trips.generateItinerary('plan-florence', { rebuild: true });
    const locked = rebuilt.days.flatMap((d) => d.items).filter((i) => i.locked).map((i) => [i.id, i.startsAt]);
    expect(locked).toEqual([['it-2', expect.stringMatching(/T10:30/)], ['it-4', expect.stringMatching(/T15:30/)]]);
    await as('khaled');
    expect((await trip('plan-florence')).days).toEqual(rebuilt.days);
  });

  it('refuses a destination without enough places instead of borrowing Florence', async () => {
    await as('ahmad');
    const t = await create({ destination: 'Tokyo' });
    await expect(services.trips.generateItinerary(t.id)).rejects.toMatchObject({ code: 'unsupported' });
    expect((await trip(t.id)).days).toEqual([]);
  });

  it('a failed build changes nothing and can be retried', async () => {
    await as('ahmad');
    const t = await create();
    simulation.failNext = true;
    await expect(services.trips.generateItinerary(t.id)).rejects.toMatchObject({ code: 'simulated' });
    expect((await trip(t.id)).generated).toBe(false);
    expect((await services.trips.generateItinerary(t.id)).generated).toBe(true);
  });
});

describe('editing (10, 11)', () => {
  it('locked stops refuse replace, move and remove; unlocking allows them', async () => {
    await as('ahmad');
    await expect(services.trips.replaceItem('plan-florence', 'it-2', 'pitti')).rejects.toMatchObject({ code: 'locked' });
    await expect(services.trips.removeItem('plan-florence', 'it-2')).rejects.toMatchObject({ code: 'locked' });
    await services.trips.toggleLock('plan-florence', 'it-2');
    const t = await services.trips.replaceItem('plan-florence', 'it-2', 'pitti');
    expect(t.days[0]!.items.find((i) => i.id === 'it-2')).toMatchObject({ placeId: 'pitti', title: 'Palazzo Pitti' });
    await expect(services.trips.replaceItem('plan-florence', 'it-3', 'pitti')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('moves to another day, changes duration and removes; travelers see it; travelers cannot edit', async () => {
    await as('ahmad');
    await services.trips.moveItem('plan-florence', 'it-3', { date: '2026-12-19', minutes: 12 * 60 });
    await services.trips.setDuration('plan-florence', 'it-6', 120);
    await services.trips.removeItem('plan-florence', 'it-9');
    await as('khaled');
    const t = await trip('plan-florence');
    const day4 = t.days.find((d) => d.date === t.endDate!.replace(/\d{2}$/, (x) => String(Number(x) - 1).padStart(2, '0')))!;
    expect(day4.items.map((i) => [i.id, hhmm(i.startsAt)])).toEqual([['it-3', '12:00']]);
    expect(t.days[0]!.items.find((i) => i.id === 'it-6')!.durationMinutes).toBe(120);
    expect(t.days.flatMap((d) => d.items).map((i) => i.id)).not.toContain('it-9');
    await expect(services.trips.removeItem('plan-florence', 'it-1')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('a traveler suggests a replacement; the organizer replaces or keeps the original', async () => {
    await as('omar');
    await services.trips.suggestReplacement('plan-florence', 'it-1', { note: 'Prefer something outdoors', placeId: 'boboli' });
    await as('ahmad');
    let t = await trip('plan-florence');
    expect(t.days[0]!.items[0]!.replaceRequests).toEqual([expect.objectContaining({ by: 'p-omar', placeId: 'boboli' })]);
    t = await services.trips.keepOriginal('plan-florence', 'it-1');
    expect(t.days[0]!.items[0]!.replaceRequests).toEqual([]);
    await expect(services.trips.removeItem('plan-florence', 'it-gone')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('today (36), completed (T05) and stored data', () => {
  it('finds the right day and stop from the clock', () => {
    const t = fx.florenceTrip;
    expect(todayOn(t, new Date(2026, 11, 10, 9))).toEqual({ kind: 'before', daysUntil: 6 });
    const during = todayOn(t, new Date(2026, 11, 16, 11, 0));
    expect(during).toMatchObject({ kind: 'during', dayIndex: 0, now: expect.objectContaining({ id: 'it-2' }) });
    if (during.kind === 'during') expect(during.next.map((i) => i.id)).toEqual(['it-3', 'it-4', 'it-5', 'it-6']);
    expect(todayOn(t, new Date(2026, 11, 21, 9)).kind).toBe('after');
  });

  it('the completed trip is past, keeps its days and takes no edits', async () => {
    await as('ahmad');
    const t = await trip('plan-tuscany');
    expect(classifyPlan(t)).toBe('past');
    expect(t.days).toHaveLength(4);
    await as('khaled');
    await expect(services.trips.generateItinerary('plan-tuscany', { rebuild: true })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('upgrades a trip stored before F7 without losing its itinerary', () => {
    const old = structuredClone(seedWorld());
    const legacy = old.plans.find((p) => p.id === 'plan-florence') as Trip;
    delete legacy.startDate; delete legacy.endDate; delete legacy.invites; delete legacy.preferences; delete legacy.picks;
    legacy.days[0]!.items[0]!.startsAt = new Date(2026, 11, 16, 9, 30).toISOString();
    const t = normalizeWorld(old).plans.find((p) => p.id === 'plan-florence') as Trip;
    expect(t.startDate).toBe(localDate(new Date(legacy.startsAt!)));
    expect(t.invites?.map((i) => i.status)).toEqual(['joined', 'joined', 'joined']);
    expect(hhmm(t.days[0]!.items[0]!.startsAt)).toBe('09:30');
  });

  it('a deleted account leaves the trip, with its choices', async () => {
    await as('omar');
    await services.auth.deleteAccount();
    await as('ahmad');
    const t = await trip('plan-florence');
    expect(t.members.map((m) => m.personId)).not.toContain('p-omar');
    expect(t.picks?.['p-omar']).toBeUndefined();
  });
});

describe('trip calendar weeks', () => {
  it('puts every day under its own weekday in rows of exactly seven', () => {
    // November 2026 starts on a Sunday: six leading blanks, the 1st in the last column.
    const nov = monthWeeks(2026, 10);
    expect(nov.every((w) => w.length === 7)).toBe(true);
    expect(nov[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(nov[4]?.[4]).toBe('2026-11-27'); // a Friday
    expect(nov.flat().filter(Boolean)).toHaveLength(30);
    // A month starting on Monday has no leading blanks.
    expect(monthWeeks(2027, 1)[0]?.[0]).toBe('2027-02-01');
  });
});
