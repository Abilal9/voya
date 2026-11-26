import type { Plan, VoyaEvent } from './types';

/**
 * Pure plan rules shared by the mock services and the UI.
 * They hold no state and import nothing from mocks, so the real API client can
 * reuse them (or the server can own them) without touching screens.
 */

export type PlanTiming = 'upcoming' | 'past';

/** The moment a plan is over: its end, or its start when it has no end. */
export function planEndsAt(plan: Plan): number | undefined {
  const at = plan.endsAt ?? plan.startsAt;
  return at ? Date.parse(at) : undefined;
}

/**
 * A plan is past once it is completed or cancelled, or once its end time has
 * gone by. Undated drafts stay upcoming. Lifecycle alone is never enough: an
 * "active" trip whose dates have passed must not be shown as Up Next.
 */
export function classifyPlan(plan: Plan, now: number = Date.now()): PlanTiming {
  if (plan.lifecycle === 'completed' || plan.lifecycle === 'cancelled') return 'past';
  const end = planEndsAt(plan);
  if (end !== undefined && end < now) return 'past';
  return 'upcoming';
}

/** Upcoming soonest first; undated plans last. */
export function sortUpcoming(a: Plan, b: Plan) {
  const sa = a.startsAt ? Date.parse(a.startsAt) : Number.POSITIVE_INFINITY;
  const sb = b.startsAt ? Date.parse(b.startsAt) : Number.POSITIVE_INFINITY;
  return sa - sb;
}

/** Past plans most recent first. */
export function sortPast(a: Plan, b: Plan) {
  return (planEndsAt(b) ?? 0) - (planEndsAt(a) ?? 0);
}

/**
 * Event headcount, one definition for every screen.
 * - invited: everyone on the guest list
 * - going:   guests whose RSVP is "going"
 * - hosts:   host and co-hosts (plan members), who are not guests
 */
export function eventCounts(event: VoyaEvent) {
  return {
    invited: event.guests.length,
    going: event.guests.filter((g) => g.rsvp === 'going').length,
    hosts: event.members.length,
  };
}

/** The headcount label every surface shows for a plan. */
export function headcountLabel(plan: Plan) {
  if (plan.type === 'event') {
    const { invited } = eventCounts(plan as VoyaEvent);
    return `${invited} ${invited === 1 ? 'guest' : 'guests'}`;
  }
  const n = plan.members.length;
  return `${n} ${n === 1 ? 'person' : 'people'}`;
}

/**
 * How a person relates to a plan. These are UI simulation rules for the mock
 * frontend, not authorization — the server enforces the real rules later.
 * - member: organizer/participant/traveler, or host/co-host of an event
 * - guest:  on an event's guest list (sees the guest view only)
 * - invited: invited to a hangout, not answered yet (sees the invitation)
 * - none:   no access, even though the record exists
 */
export type PlanRelation = 'member' | 'guest' | 'invited' | 'none';

export function relationTo(plan: Plan, personId: string): PlanRelation {
  if (plan.members.some((m) => m.personId === personId)) return 'member';
  if (plan.type === 'event' && plan.guests.some((g) => g.personId === personId)) return 'guest';
  // Invited to a hangout and not answered yet: sees the invitation (17) only.
  if (plan.type === 'hangout' && (plan.invites ?? []).some((i) => i.personId === personId && i.status === 'pending')) {
    return 'invited';
  }
  return 'none';
}

export function canSee(plan: Plan, personId: string): boolean {
  return relationTo(plan, personId) !== 'none';
}

/** The event as a guest may see it: no host-only schedule items, no guest identities. */
export function guestView(event: VoyaEvent): VoyaEvent {
  return {
    ...event,
    schedule: event.schedule.filter((i) => i.visibility !== 'hosts_only'),
    guests: event.guests.map((g) => ({ ...g, personId: undefined })),
  };
}
