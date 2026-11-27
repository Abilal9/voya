import type {
  ID, Place, PlaceCategory, Trip, TripDay, TripDiscovery, TripItem, TripPace, TripPick, TripPreferences,
} from './types';

/**
 * Trip rules shared by the mock services and the screens. Trips are planned
 * by a group: travelers set preferences (06), pick places (07), the group's
 * progress shows on 08, and a deterministic mock generator builds the days
 * (09). None of the Hangout vote/finalize rules apply here.
 *
 * Everything here is a frontend simulation. It is NOT the production
 * scheduler: no opening hours, no routing, no live availability.
 */

// ------------------------------------------------------------ dates (date-only)

const DAY_MS = 86400000;
/** "YYYY-MM-DD" at UTC noon: safe from DST and the phone's time zone. */
const utcNoon = (date: string) => Date.parse(`${date}T12:00:00Z`);
export const isDateOnly = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(utcNoon(v));
export const addDays = (date: string, n: number) => new Date(utcNoon(date) + n * DAY_MS).toISOString().slice(0, 10);
export const nightsBetween = (start: string, end: string) => Math.round((utcNoon(end) - utcNoon(start)) / DAY_MS);
/** The local calendar date of a Date, as "YYYY-MM-DD". */
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The planned days: one per night (board 04/09: 18–22 November is 4 nights,
 * Days 1–4; the 22nd is the way home). A same-day trip gets one day.
 */
export function plannedDates(start?: string, end?: string): string[] {
  if (!isDateOnly(start) || !isDateOnly(end)) return [];
  const n = Math.max(1, nightsBetween(start, end));
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/** Formats a date-only value without letting the phone's zone move the day. */
export function formatDay(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(utcNoon(date)).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
}

/** "18–22 November", "29 November – 3 December" (day before month, as on the board). */
export function dateRange(start?: string, end?: string) {
  if (!isDateOnly(start) || !isDateOnly(end)) return '';
  const day = (d: string) => formatDay(d, { day: 'numeric' });
  const month = (d: string) => formatDay(d, { month: 'long' });
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${day(start)}–${day(end)} ${month(end)}`
    : `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`;
}

/** Floating local wall time "YYYY-MM-DDTHH:MM:00" (no zone, see TripItem). */
export const wallTime = (date: string, minutes: number) =>
  `${addDays(date, Math.floor(minutes / 1440))}T${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
/** Minutes after midnight of `date` for a wall time (can exceed 1440 after midnight). */
export const minutesOf = (wall: string, date: string) =>
  nightsBetween(date, wall.slice(0, 10)) * 1440 + Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
export const hhmm = (wall: string) => wall.slice(11, 16);

export function durationLabel(min?: number) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// ------------------------------------------------------------ people

export function travelers(trip: Trip): ID[] {
  return trip.members.map((m) => m.personId);
}

export type TravelerStatus = 'ready' | 'choosing' | 'joined' | 'invited' | 'declined';

/** 05 / 08 / 35: where each traveler is. "Ready" = preferences set and places chosen. */
export function travelerStatus(trip: Trip, personId: ID): TravelerStatus {
  if (trip.members.some((m) => m.personId === personId)) {
    const prefs = !!trip.preferences?.[personId];
    if (prefs && (trip.doneChoosing ?? []).includes(personId)) return 'ready';
    return prefs || Object.keys(trip.picks?.[personId] ?? {}).length ? 'choosing' : 'joined';
  }
  const invite = trip.invites?.find((i) => i.personId === personId);
  if (invite?.status === 'declined') return 'declined';
  return 'invited';
}

export function readyCount(trip: Trip) {
  return travelers(trip).filter((p) => travelerStatus(trip, p) === 'ready').length;
}

// ------------------------------------------------------------ preferences

/** 06 chips. Each maps to the place data it can actually be matched against. */
export const TRIP_INTERESTS = ['Food', 'Culture', 'Museums', 'Shopping', 'Nature', 'Hidden gems', 'Nightlife', 'Experiences'] as const;
export const PACES: readonly TripPace[] = ['Relaxed', 'Balanced', 'Packed'];
export const DISCOVERIES: readonly TripDiscovery[] = ['Iconic spots', 'Mix', 'Hidden gems'];

const isIconic = (p: Place) => (p.tags ?? []).includes('Popular') || (p.rating ?? 0) >= 4.8;

export function matchesInterest(place: Place, interest: string): boolean {
  switch (interest) {
    case 'Food': return (['Food', 'Coffee', 'Dessert'] as PlaceCategory[]).includes(place.category);
    case 'Culture': return place.category === 'Culture';
    case 'Museums': return /museum|gallery|palace/i.test(place.type ?? '');
    case 'Shopping': return place.category === 'Shopping';
    case 'Nature': return place.category === 'Nature';
    case 'Hidden gems': return !isIconic(place);
    case 'Nightlife': return place.category === 'Nightlife';
    case 'Experiences': return place.category === 'Experiences' || place.category === 'Activities';
    default: return false;
  }
}

/** Account interests that also exist on 06, as a starting suggestion only. */
export function suggestedInterests(accountInterests: string[]): string[] {
  return TRIP_INTERESTS.filter((i) => accountInterests.some((a) => a.toLowerCase() === i.toLowerCase()));
}

/** The group's pace: the most common choice; ties go to Balanced. */
export function groupPace(prefs: TripPreferences[]): TripPace {
  if (!prefs.length) return 'Balanced';
  const n = (p: TripPace) => prefs.filter((x) => x.pace === p).length;
  const best = Math.max(...PACES.map(n));
  return n('Balanced') === best ? 'Balanced' : PACES.find((p) => n(p) === best)!;
}

// ------------------------------------------------------------ places and picks

const isStay = (p: Place) => /hotel|stay/i.test(p.type ?? '');

/** Places the group can choose from at the destination (07 deck, 11 alternatives). */
export function destinationPool(trip: Pick<Trip, 'destination'>, places: Place[]): Place[] {
  return places
    .filter((p) => p.city.toLowerCase() === trip.destination.toLowerCase() && !p.permanentlyClosed && !isStay(p))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Fewer than this and the mock generator says the destination isn't supported yet. */
export const MIN_PLACES_TO_GENERATE = 6;
export const canGenerateFor = (trip: Pick<Trip, 'destination'>, places: Place[]) =>
  destinationPool(trip, places).length >= MIN_PLACES_TO_GENERATE;

export function pickOf(trip: Trip, personId: ID, placeId: ID): TripPick | undefined {
  return trip.picks?.[personId]?.[placeId];
}

/** Travelers who like or must-do a place (08 "4/4 interested", 10, 11). */
export function interestedIn(trip: Trip, placeId: ID): ID[] {
  return travelers(trip).filter((p) => {
    const pick = pickOf(trip, p, placeId);
    return pick === 'like' || pick === 'must' || (trip.mustDoBy?.[placeId] ?? []).includes(p);
  });
}

/** 08 "Early matches": places at least one traveler wants, most wanted first. */
export function groupMatches(trip: Trip, places: Place[]) {
  return destinationPool(trip, places)
    .map((place) => ({ place, interested: interestedIn(trip, place.id).length }))
    .filter((m) => m.interested > 0)
    .sort((a, b) => b.interested - a.interested || a.place.id.localeCompare(b.place.id));
}

// ------------------------------------------------------------ generation

const MEAL_SLOTS = [{ at: 9 * 60, label: 'Breakfast', minutes: 60 }, { at: 13 * 60 + 30, label: 'Lunch', minutes: 75 }, { at: 20 * 60 + 30, label: 'Dinner', minutes: 90 }];
const ACTIVITY_SLOTS = [10 * 60 + 30, 15 * 60 + 30, 17 * 60];
const BREAK_AT = 18 * 60;
const SLOTS_FOR: Record<TripPace, { meals: number; activities: number }> = {
  Relaxed: { meals: 2, activities: 1 },
  Balanced: { meals: 3, activities: 2 },
  Packed: { meals: 3, activities: 3 },
};
const isMeal = (p: Place) => (['Food', 'Coffee', 'Dessert'] as PlaceCategory[]).includes(p.category);

/** Mock durations by kind of place: clearly fixture values, not provider data. */
export function defaultMinutes(p: Place): number {
  if (/museum|gallery|palace/i.test(p.type ?? '')) return 150;
  switch (p.category) {
    case 'Culture': return 90;
    case 'Nature': return 90;
    case 'Shopping': return 90;
    case 'Nightlife': return 120;
    default: return 90;
  }
}

/**
 * Deterministic score: must-dos first, then how many travelers like a place,
 * then how well it fits everyone's interests and discovery style; "Not for me"
 * counts against. Ties break on the place id, so the same inputs always give
 * the same itinerary.
 */
export function scorePlace(trip: Trip, place: Place): number {
  const people = travelers(trip);
  const prefs = people.map((p) => trip.preferences?.[p]).filter((x): x is TripPreferences => !!x);
  let score = 0;
  if (trip.mustDoPlaceIds.includes(place.id)) score += 100;
  for (const p of people) {
    const pick = pickOf(trip, p, place.id);
    if (pick === 'must') score += 20;
    if (pick === 'like') score += 10;
    if (pick === 'skip') score -= 15;
  }
  for (const pr of prefs) {
    score += pr.interests.filter((i) => matchesInterest(place, i)).length * 2;
    if (pr.discoveries === 'Iconic spots' && isIconic(place)) score += 2;
    if (pr.discoveries === 'Hidden gems' && !isIconic(place)) score += 2;
  }
  return score;
}

const DAY_TITLES: [RegExp, string][] = [
  [/museum|gallery|palace/i, 'A little art. A lot of good food.'],
  [/garden|park|view|piazzale/i, 'The slower route'],
];

let itemSeq = 0;
const newId = () => `it-${Date.now().toString(36)}-${(itemSeq++).toString(36)}`;

/**
 * Builds the trip's days. Locked stops stay exactly where they are and their
 * places aren't used again; every other stop is rebuilt. Each place is used
 * at most once. A slot with nothing good left stays empty rather than
 * repeating a place.
 */
export function buildItinerary(trip: Trip, places: Place[], makeId: () => string = newId): TripDay[] {
  const dates = plannedDates(trip.startDate, trip.endDate);
  const locked = trip.days.flatMap((d) => d.items.filter((i) => i.locked).map((i) => ({ ...i, date: d.date })));
  const used = new Set(locked.map((i) => i.placeId).filter(Boolean) as string[]);
  const ranked = destinationPool(trip, places)
    .map((p) => ({ p, s: scorePlace(trip, p) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .map((x) => x.p);
  const meals = ranked.filter(isMeal);
  const activities = ranked.filter((p) => !isMeal(p));
  const pace = groupPace(travelers(trip).map((p) => trip.preferences?.[p]).filter((x): x is TripPreferences => !!x));
  const slots = SLOTS_FOR[pace];
  const take = (list: Place[]) => {
    const i = list.findIndex((p) => !used.has(p.id));
    if (i === -1) return undefined;
    used.add(list[i]!.id);
    return list[i];
  };
  const stay = trip.accommodation?.trim();

  return dates.map((date, dayIndex) => {
    const keep = locked.filter((i) => i.date === date).map(({ date: _d, ...i }) => i);
    const taken = (at: number, minutes: number) =>
      keep.some((k) => {
        const s = minutesOf(k.startsAt, date);
        const e = k.endsAt ? minutesOf(k.endsAt, date) : s + 60;
        return at < e && s < at + minutes;
      });
    const items: TripItem[] = [...keep];
    // Must-dos spread over the days: the best activity goes to the earliest free slot.
    ACTIVITY_SLOTS.slice(0, slots.activities).forEach((at) => {
      const place = take(activities);
      if (!place) return;
      const minutes = defaultMinutes(place);
      if (taken(at, minutes)) { used.delete(place.id); return; }
      items.push({
        id: makeId(), kind: 'activity', title: place.name, subtitle: durationLabel(minutes), placeId: place.id,
        startsAt: wallTime(date, at), endsAt: wallTime(date, at + minutes), durationMinutes: minutes,
      });
    });
    MEAL_SLOTS.slice(0, slots.meals === 2 ? 3 : slots.meals).filter((_, i) => slots.meals === 3 || i !== 0).forEach((slot) => {
      const place = take(meals);
      if (!place) return;
      if (taken(slot.at, slot.minutes)) { used.delete(place.id); return; }
      items.push({
        id: makeId(), kind: 'meal', title: slot.label, subtitle: place.name, placeId: place.id,
        startsAt: wallTime(date, slot.at), endsAt: wallTime(date, slot.at + slot.minutes), durationMinutes: slot.minutes,
      });
    });
    if (stay && pace !== 'Packed' && !taken(BREAK_AT, 90)) {
      items.push({
        id: makeId(), kind: 'break', title: 'Hotel / break', subtitle: 'A little time to recharge',
        startsAt: wallTime(date, BREAK_AT), endsAt: wallTime(date, BREAK_AT + 90), durationMinutes: 90,
      });
    }
    items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const names = items.map((i) => places.find((p) => p.id === i.placeId)?.type ?? '').join(' ');
    const title = dayIndex === 0
      ? `Hello, ${trip.destination}`
      : dayIndex === dates.length - 1 && dates.length > 1
        ? 'One last look'
        : DAY_TITLES.find(([re]) => re.test(names))?.[1];
    return { date, title, items };
  });
}

// ------------------------------------------------------------ today (36)

export type TodayState =
  | { kind: 'before'; daysUntil: number }
  | { kind: 'after' }
  | { kind: 'during'; dayIndex: number; day: TripDay; now?: TripItem; running: boolean; next: TripItem[] };

/**
 * Today on a trip, from a moment (`now`, a Date). Trip times are wall times,
 * so they compare with the phone's local clock. `now` is the item running now,
 * or else the next one coming up.
 */
export function todayOn(trip: Trip, now: Date): TodayState {
  const dates = plannedDates(trip.startDate, trip.endDate);
  if (!dates.length) return { kind: 'after' };
  const today = localDate(now);
  if (today < dates[0]!) return { kind: 'before', daysUntil: nightsBetween(today, dates[0]!) };
  const dayIndex = dates.indexOf(today);
  if (dayIndex === -1) return { kind: 'after' };
  const day = trip.days.find((d) => d.date === today) ?? { date: today, items: [] };
  const wallNow = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const items = [...day.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const current = items.find((i) => i.startsAt <= wallNow && wallNow < (i.endsAt ?? i.startsAt));
  const upcoming = items.filter((i) => i.startsAt > wallNow);
  const focus = current ?? upcoming[0];
  return { kind: 'during', dayIndex, day, now: focus, running: !!current, next: upcoming.filter((i) => i !== focus) };
}
