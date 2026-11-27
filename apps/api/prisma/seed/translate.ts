import type { InviteStatus } from '@prisma/client';

/**
 * Turns a mobile fixture plan into what the API stores: fixture person and
 * place refs inside the type-specific state become profile and place ids,
 * and people invited to the plan (hangout/trip invites, event guests on
 * Voya) become `plan_invitees` rows. Guests added by name only stay in the
 * document. Every ref is translated by field, never by matching text, and an
 * unknown ref is an error.
 */

type Json = Record<string, unknown>;
export type Lookup = (ref: string) => string;

export interface SeedInvitee {
  profileId: string;
  status: InviteStatus;
  invitedById: string;
  invitedAt: Date;
  respondedAt: Date | null;
}

const STATUS: Record<string, InviteStatus> = {
  pending: 'pending', in: 'accepted', joined: 'accepted', going: 'accepted', maybe: 'maybe', declined: 'declined',
};

const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const rekey = <T>(value: unknown, key: Lookup, map: (v: T) => T = (v) => v): Json =>
  Object.fromEntries(Object.entries((value ?? {}) as Record<string, T>).map(([k, v]) => [key(k), map(v)]));

export function translatePlan(
  type: 'trip' | 'hangout' | 'event',
  input: Json,
  person: Lookup,
  place: Lookup,
): { details: Json; invitees: SeedInvitee[] } {
  const d = structuredClone(input);
  const optPlace = (item: Json) => {
    if (typeof item.placeId === 'string') item.placeId = place(item.placeId);
  };
  const invitee = (raw: Json, status: string): SeedInvitee => {
    const mapped = STATUS[status];
    if (!mapped) throw new Error(`Unknown invite status "${status}"`);
    return {
      profileId: person(raw.personId as string),
      status: mapped,
      invitedById: person(raw.invitedBy as string),
      invitedAt: new Date(raw.invitedAt as string),
      respondedAt: typeof raw.respondedAt === 'string' ? new Date(raw.respondedAt) : null,
    };
  };

  let invitees: SeedInvitee[] = [];
  if (type === 'hangout') {
    for (const sg of list(d.suggestions)) {
      sg.placeId = place(sg.placeId as string);
      sg.suggestedBy = person(sg.suggestedBy as string);
      sg.votes = rekey(sg.votes, person);
    }
    list(d.timeline).forEach(optPlace);
    for (const cr of list(d.changeRequests)) {
      cr.by = person(cr.by as string);
      optPlace(cr);
    }
    invitees = list(d.invites).map((i) => invitee(i, i.status as string));
    delete d.invites;
  } else if (type === 'trip') {
    d.mustDoPlaceIds = (d.mustDoPlaceIds as string[] | undefined ?? []).map(place);
    d.mustDoBy = rekey<string[]>(d.mustDoBy, place, (by) => by.map(person));
    d.preferences = rekey(d.preferences, person);
    d.picks = rekey<Json>(d.picks, person, (picks) => rekey(picks, place));
    d.doneChoosing = (d.doneChoosing as string[] | undefined ?? []).map(person);
    for (const day of list(d.days)) {
      for (const item of list(day.items)) {
        optPlace(item);
        for (const r of list(item.replaceRequests)) {
          r.by = person(r.by as string);
          optPlace(r);
        }
      }
    }
    invitees = list(d.invites).map((i) => invitee(i, i.status as string));
    delete d.invites;
  } else {
    list(d.schedule).forEach(optPlace);
    const guests = list(d.guests);
    invitees = guests.filter((g) => typeof g.personId === 'string').map((g) => invitee(g, g.rsvp as string));
    d.guests = guests
      .filter((g) => typeof g.personId !== 'string')
      .map((g) => (typeof g.invitedBy === 'string' ? { ...g, invitedBy: person(g.invitedBy) } : g));
  }
  return { details: d, invitees };
}
