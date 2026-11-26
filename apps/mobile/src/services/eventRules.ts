import type {
  Capability, CohostPermissions, EventScheduleItem, ID, PlanMember, RSVP, VoyaEvent,
} from './types';

/**
 * Event rules shared by the mock services and the screens. Events are host-led:
 * hosts and co-hosts are plan members, guests answer an invitation. None of the
 * Hangout suggestion/vote/finalize rules apply here.
 *
 * These are frontend simulation rules, not authorization.
 */

/** Hosts can do everything (EV01–EV04, 23, 40). */
export const HOST_CAPABILITIES: Capability[] = [
  'plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'schedule.edit',
];

/** Board default for "Manage permissions": co-hosts help with guests and the schedule. */
export const DEFAULT_COHOST_PERMISSIONS: CohostPermissions = { details: false, guests: true, schedule: true };

export function cohostCapabilities(p: CohostPermissions): Capability[] {
  const caps: Capability[] = [];
  if (p.details) caps.push('plan.edit');
  if (p.guests) caps.push('member.manage', 'invite.create');
  if (p.schedule) caps.push('schedule.edit');
  return caps;
}

export function permissionsOf(event: VoyaEvent): CohostPermissions {
  return event.cohostPermissions ?? DEFAULT_COHOST_PERMISSIONS;
}

export function hostMember(personId: ID, role: 'host' | 'co-host', perms: CohostPermissions): PlanMember {
  return {
    personId, role,
    capabilities: role === 'host' ? [...HOST_CAPABILITIES] : cohostCapabilities(perms),
    joinedAt: new Date().toISOString(),
  };
}

/**
 * How someone relates to an event:
 * - host / co-host: plan members
 * - invited: on the guest list, has not answered (sees the invitation, 20)
 * - guest: answered going, maybe or can't make it (sees 21)
 * - none: no access
 */
export type EventRole = 'host' | 'co-host' | 'invited' | 'guest' | 'none';

export function eventRole(event: VoyaEvent, personId: ID): EventRole {
  const member = event.members.find((m) => m.personId === personId);
  if (member) return member.role === 'co-host' ? 'co-host' : 'host';
  const guest = event.guests.find((g) => g.personId === personId);
  if (guest) return guest.rsvp === 'pending' ? 'invited' : 'guest';
  return 'none';
}

export function canDo(event: VoyaEvent, personId: ID, capability: Capability): boolean {
  return !!event.members.find((m) => m.personId === personId)?.capabilities.includes(capability);
}

/** Only hosts (not co-hosts) manage hosts, permissions and cancelling. */
export function isHost(event: VoyaEvent, personId: ID): boolean {
  return event.members.some((m) => m.personId === personId && m.role !== 'co-host');
}

/** The four numbers on 40 (and three of them on 19 / EV05). Pending is never counted as going. */
export function rsvpCounts(event: Pick<VoyaEvent, 'guests'>) {
  const count = (r: RSVP) => event.guests.filter((g) => g.rsvp === r).length;
  return { going: count('going'), maybe: count('maybe'), awaiting: count('pending'), declined: count('declined') };
}

export const RSVP_LABEL: Record<RSVP, string> = {
  going: 'Going', maybe: 'Maybe', pending: 'Awaiting', declined: 'Can’t attend',
};

/** Host order: the owner, then hosts, then co-hosts. */
export function hostsInOrder(event: VoyaEvent): PlanMember[] {
  const rank = (m: PlanMember) => (m.personId === event.ownerId ? 0 : m.role === 'co-host' ? 2 : 1);
  return [...event.members].sort((a, b) => rank(a) - rank(b));
}

/** "Ahmad & Nisreen", "Ahmad, Nisreen & Sara": hosts only, not co-hosts (19, 22). */
export function hostLine(event: VoyaEvent, firstNameOf: (id: ID) => string): string {
  const names = hostsInOrder(event).filter((m) => m.role !== 'co-host').map((m) => firstNameOf(m.personId)).filter(Boolean);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export class ScheduleItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleItemError';
  }
}

/**
 * Validates and normalises one EV06 item. An end time earlier than the start
 * runs past midnight (23:30–00:00), so it moves to the next day.
 */
export function normaliseScheduleItem<T extends Partial<EventScheduleItem>>(item: T): T & { startsAt: string; title: string } {
  const title = item.title?.trim() ?? '';
  if (!title) throw new ScheduleItemError('Give this moment a title.');
  if (title.length > 60) throw new ScheduleItemError('Keep the title under 60 characters.');
  const start = item.startsAt ? Date.parse(item.startsAt) : Number.NaN;
  if (Number.isNaN(start)) throw new ScheduleItemError('Choose a start time.');
  let endsAt = item.endsAt;
  if (endsAt) {
    let end = Date.parse(endsAt);
    if (Number.isNaN(end)) throw new ScheduleItemError('That end time isn’t valid.');
    while (end <= start) end += 86400000;
    endsAt = new Date(end).toISOString();
  }
  const clean = (v?: string) => (v?.trim() ? v.trim() : undefined);
  const location = clean(item.location);
  const notes = clean(item.notes);
  const instructions = clean(item.instructions);
  return {
    ...item, title, startsAt: new Date(start).toISOString(), endsAt, location, notes, instructions,
    subtitle: location ?? instructions ?? notes,
    visibility: item.visibility ?? 'all_guests',
  };
}

export function sortSchedule<T extends { startsAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
