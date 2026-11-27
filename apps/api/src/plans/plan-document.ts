import type { InviteStatus } from '@prisma/client';
import {
  PlanSchema,
  type Capability,
  type EventGuest,
  type Plan,
  type PlanMember,
  type PlanRole,
  type PlanType,
  type Rsvp,
  type VoyaEvent,
} from '@voya/contracts';

/**
 * Pure plan rules on the server: who relates to a plan how, what each viewer
 * may see, and how a person is taken off a plan. No database access here, so
 * every rule is unit-tested on plain data. They mirror the frozen app's mock
 * (apps/mobile/src/mocks/services.ts, services/planRules.ts) — but here they
 * are the authorization, not a simulation.
 */

export interface MemberState {
  profileId: string;
  role: PlanRole;
  capabilities: Capability[];
  joinedAt: Date;
  muted: boolean;
}

export interface InviteeState {
  id: string;
  profileId: string;
  displayName: string;
  status: InviteStatus;
  invitedById: string | null;
  invitedAt: Date;
  respondedAt: Date | null;
  muted: boolean;
}

/** A plan as loaded from `plans` + `plan_members` + `plan_invitees`. */
export interface PlanState {
  id: string;
  type: PlanType;
  title: string;
  city: string;
  lifecycle: Plan['lifecycle'];
  ownerId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  details: Record<string, unknown>;
  version: number;
  /** Ordered by `joinedAt` (the hand-over order). */
  members: MemberState[];
  invitees: InviteeState[];
}

// ------------------------------------------------------------------ relation

/**
 * - member:  on `plan_members` (organizer, participant, traveler, host, co-host)
 * - guest:   on an event's guest list, whatever the answer (guest view only)
 * - invited: a hangout or trip invitation not answered yet (sees the invitation)
 * - none:    no access; reported as not found
 */
export type PlanRelation = 'member' | 'guest' | 'invited' | 'none';

export function relationOf(plan: PlanState, profileId: string): PlanRelation {
  if (plan.members.some((m) => m.profileId === profileId)) return 'member';
  const invitee = plan.invitees.find((i) => i.profileId === profileId);
  if (!invitee) return 'none';
  if (plan.type === 'event') return 'guest';
  return invitee.status === 'pending' ? 'invited' : 'none';
}

export function memberOf(plan: PlanState, profileId: string): MemberState | undefined {
  return plan.members.find((m) => m.profileId === profileId);
}

export function can(plan: PlanState, profileId: string, capability: Capability): boolean {
  return !!memberOf(plan, profileId)?.capabilities.includes(capability);
}

// ---------------------------------------------------------------- statuses

const HANGOUT_STATUS: Record<InviteStatus, 'pending' | 'in' | 'maybe' | 'declined'> = {
  pending: 'pending', accepted: 'in', maybe: 'maybe', declined: 'declined',
};
const TRIP_STATUS: Record<InviteStatus, 'pending' | 'joined' | 'declined'> = {
  pending: 'pending', accepted: 'joined', maybe: 'pending', declined: 'declined',
};
const EVENT_RSVP: Record<InviteStatus, Rsvp> = {
  pending: 'pending', accepted: 'going', maybe: 'maybe', declined: 'declined',
};

// --------------------------------------------------------------- projection

const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function membersOf(plan: PlanState): PlanMember[] {
  return plan.members.map((m) => ({
    personId: m.profileId, role: m.role, capabilities: [...m.capabilities], joinedAt: iso(m.joinedAt),
  }));
}

/** The whole plan document, as a member sees it. Validated against the shared contract. */
export function toDocument(plan: PlanState): Plan {
  const { coverPhoto, ...details } = plan.details as Record<string, unknown> & { coverPhoto?: string };
  const base = {
    id: plan.id,
    type: plan.type,
    title: plan.title,
    city: plan.city,
    lifecycle: plan.lifecycle,
    ownerId: plan.ownerId,
    members: membersOf(plan),
    ...(plan.startsAt ? { startsAt: iso(plan.startsAt) } : {}),
    ...(plan.endsAt ? { endsAt: iso(plan.endsAt) } : {}),
    ...(typeof coverPhoto === 'string' ? { coverPhoto } : {}),
    version: plan.version,
  };
  const invites = (map: Record<InviteStatus, string>) =>
    plan.invitees.map((i) => ({
      personId: i.profileId,
      status: map[i.status],
      invitedBy: i.invitedById ?? plan.ownerId,
      invitedAt: iso(i.invitedAt),
    }));

  let doc: unknown;
  if (plan.type === 'hangout') {
    doc = { ...details, ...base, invites: invites(HANGOUT_STATUS) };
  } else if (plan.type === 'trip') {
    doc = {
      ...details,
      ...base,
      ...(plan.startDate ? { startDate: isoDate(plan.startDate) } : {}),
      ...(plan.endDate ? { endDate: isoDate(plan.endDate) } : {}),
      invites: invites(TRIP_STATUS),
    };
  } else {
    const named = (Array.isArray(details.guests) ? details.guests : []) as EventGuest[];
    const onVoya: EventGuest[] = plan.invitees.map((i) => ({
      id: i.id,
      personId: i.profileId,
      displayName: i.displayName,
      rsvp: EVENT_RSVP[i.status],
      ...(i.invitedById ? { invitedBy: i.invitedById } : {}),
      invitedAt: iso(i.invitedAt),
      ...(i.respondedAt ? { respondedAt: iso(i.respondedAt) } : {}),
    }));
    const guests = [...onVoya, ...named].sort(
      (a, b) => Date.parse(a.invitedAt ?? '') - Date.parse(b.invitedAt ?? '') || a.id.localeCompare(b.id),
    );
    doc = { ...details, ...base, guests };
  }
  return PlanSchema.parse(doc);
}

/**
 * The event as a guest may see it: no host-only schedule items, no co-host
 * settings and no other guests' identities (only their answers, for counts).
 * The viewer's own row keeps its name and is marked with `viewerGuestId`.
 */
export function guestView(event: VoyaEvent, viewerId: string): VoyaEvent {
  const own = event.guests.find((g) => g.personId === viewerId);
  const rest: VoyaEvent = { ...event };
  delete rest.cohostPermissions;
  return {
    ...rest,
    ...(own ? { viewerGuestId: own.id } : {}),
    schedule: event.schedule.filter((i) => i.visibility !== 'hosts_only'),
    guests: event.guests.map((g) => ({ id: g.id, rsvp: g.rsvp, displayName: g.id === own?.id ? g.displayName : '' })),
  };
}

/** What `viewerId` may see of the plan, or null when they may not see it at all. */
export function projectFor(plan: PlanState, viewerId: string): Plan | null {
  const relation = relationOf(plan, viewerId);
  if (relation === 'none') return null;
  const doc = toDocument(plan);
  return doc.type === 'event' && relation === 'guest' ? guestView(doc, viewerId) : doc;
}

// ------------------------------------------------------------------- timing

/** A plan is past once completed/cancelled or once its end (or start) has gone by. Undated stays upcoming. */
export function timingOf(plan: Pick<PlanState, 'lifecycle' | 'startsAt' | 'endsAt'>, now: number): 'upcoming' | 'past' {
  if (plan.lifecycle === 'completed' || plan.lifecycle === 'cancelled') return 'past';
  const end = plan.endsAt ?? plan.startsAt;
  return end && end.getTime() < now ? 'past' : 'upcoming';
}

export function sortUpcoming(a: PlanState, b: PlanState): number {
  const sa = a.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const sb = b.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return sa - sb || a.id.localeCompare(b.id);
}

export function sortPast(a: PlanState, b: PlanState): number {
  const ea = (a.endsAt ?? a.startsAt)?.getTime() ?? 0;
  const eb = (b.endsAt ?? b.startsAt)?.getTime() ?? 0;
  return eb - ea || a.id.localeCompare(b.id);
}

// ------------------------------------------------------------------ removal

/** Shown in place of a deleted person's name on what they left behind. */
export const FORMER_MEMBER = 'former-member';

type Json = Record<string, unknown>;
const records = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const object = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});

/**
 * Takes a person's inputs off a plan document's type-specific state.
 * - hangout: their votes go; their suggestions stay (credited to a former
 *   member once the account is deleted)
 * - trip: their preferences, picks, "done choosing", must-dos and
 *   replacement requests go (a must-do nobody else wanted goes with them)
 * - event: nothing personal is kept in the document beyond who added a guest
 */
export function forgetInDetails(type: PlanType, input: Json, personId: string, deleted: boolean): Json {
  const details = structuredClone(input);
  if (type === 'hangout') {
    for (const sg of records(details.suggestions)) {
      delete object(sg.votes)[personId];
      if (deleted && sg.suggestedBy === personId) sg.suggestedBy = FORMER_MEMBER;
    }
    if (deleted) for (const cr of records(details.changeRequests)) if (cr.by === personId) cr.by = FORMER_MEMBER;
  } else if (type === 'trip') {
    delete object(details.preferences)[personId];
    delete object(details.picks)[personId];
    if (Array.isArray(details.doneChoosing)) details.doneChoosing = details.doneChoosing.filter((p) => p !== personId);
    const mustDoBy = object(details.mustDoBy);
    for (const [placeId, by] of Object.entries(mustDoBy)) {
      const before = Array.isArray(by) ? (by as string[]) : [];
      if (!before.includes(personId)) continue;
      const after = before.filter((p) => p !== personId);
      if (after.length > 0) {
        mustDoBy[placeId] = after;
      } else {
        delete mustDoBy[placeId];
        if (Array.isArray(details.mustDoPlaceIds)) details.mustDoPlaceIds = details.mustDoPlaceIds.filter((p) => p !== placeId);
      }
    }
    for (const day of records(details.days)) {
      for (const item of records(day.items)) {
        if (Array.isArray(item.replaceRequests)) {
          item.replaceRequests = records(item.replaceRequests).filter((r) => r.by !== personId);
        }
      }
    }
  } else if (deleted) {
    for (const guest of records(details.guests)) if (guest.invitedBy === personId) delete guest.invitedBy;
  }
  return details;
}

export type Removal =
  | { kind: 'untouched' }
  | { kind: 'plan_deleted' }
  | {
      kind: 'updated';
      /** The member who now owns the plan, when ownership moved. */
      heir?: { profileId: string; role: PlanRole; capabilities: Capability[] };
      /** Invitee rows that go with the person (the heir's own pending hangout invite). */
      dropInviteeOf: string[];
      details: Json;
    };

/**
 * Takes `personId` off the plan: their membership and invitation go, their
 * inputs are forgotten, and a leaving owner hands the plan to the member who
 * joined next (who takes over the owner's role and capabilities). A plan
 * with nobody left on it is deleted — except an event that still has
 * guests, which stays (read-only) for them while its owner still exists.
 * When the account is being deleted (`deleted`), a plan it would still own
 * is deleted too: nobody is left who could manage it.
 */
export function removePerson(plan: PlanState, personId: string, deleted: boolean): Removal {
  const leaving = memberOf(plan, personId);
  const invited = plan.invitees.some((i) => i.profileId === personId);
  const mentioned = JSON.stringify(plan.details).includes(personId);
  if (!leaving && !invited && plan.ownerId !== personId && !mentioned) return { kind: 'untouched' };

  const remaining = plan.members.filter((m) => m.profileId !== personId);
  const remainingInvitees = plan.invitees.filter((i) => i.profileId !== personId);
  const details = forgetInDetails(plan.type, plan.details, personId, deleted);
  const namedGuests = plan.type === 'event' ? records(details.guests).length : 0;
  const guestsLeft = plan.type === 'event' && remainingInvitees.length + namedGuests > 0;

  if (remaining.length === 0 && !guestsLeft) return { kind: 'plan_deleted' };

  let heir: { profileId: string; role: PlanRole; capabilities: Capability[] } | undefined;
  const dropInviteeOf: string[] = [];
  if (plan.ownerId === personId) {
    const next = remaining[0];
    if (!next) return deleted ? { kind: 'plan_deleted' } : { kind: 'updated', dropInviteeOf, details };
    heir = {
      profileId: next.profileId,
      role: leaving ? leaving.role : next.role,
      capabilities: leaving ? [...new Set([...next.capabilities, ...leaving.capabilities])] : next.capabilities,
    };
    if (plan.type === 'hangout') dropInviteeOf.push(next.profileId);
  }
  return { kind: 'updated', ...(heir ? { heir } : {}), dropInviteeOf, details };
}
