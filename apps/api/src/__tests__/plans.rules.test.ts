import { HANGOUT_TEMPLATE_SLOTS, PlanSchema, type VoyaEvent } from '@voya/contracts';
import fixtures from '../../prisma/seed/fixtures.json';
import { translatePlan } from '../../prisma/seed/translate';
import { parseIfMatch } from '../plans/plans.controller';
import {
  FORMER_MEMBER,
  forgetInDetails,
  projectFor,
  relationOf,
  removePerson,
  timingOf,
  type InviteeState,
  type MemberState,
  type PlanState,
} from '../plans/plan-document';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const D = '00000000-0000-4000-8000-00000000000d';

const member = (profileId: string, role: MemberState['role'], at: number, capabilities: MemberState['capabilities'] = []): MemberState => ({
  profileId, role, capabilities, joinedAt: new Date(at), muted: false,
});
const invitee = (profileId: string, status: InviteeState['status'], id = `${profileId.slice(-1)}-guest`): InviteeState => ({
  id, profileId, displayName: `Person ${profileId.slice(-1)}`, status, invitedById: A, invitedAt: new Date(1000), respondedAt: null, muted: false,
});

function plan(overrides: Partial<PlanState>): PlanState {
  return {
    id: '00000000-0000-4000-8000-0000000000f1', type: 'hangout', title: 'Friday', city: 'Riyadh', lifecycle: 'active',
    ownerId: A, startsAt: new Date('2030-01-01T18:00:00Z'), endsAt: null, startDate: null, endDate: null,
    details: { template: 'Dinner', suggestions: [], finalized: false, timeline: [], changeRequests: [] },
    version: 3, members: [member(A, 'organizer', 1, ['plan.edit', 'member.manage', 'invite.create'])], invitees: [],
    ...overrides,
  };
}

function event(overrides: Partial<PlanState> = {}): PlanState {
  return plan({
    type: 'event',
    details: {
      venue: 'Hall', cohostPermissions: { details: false, guests: true, schedule: true },
      guests: [{ id: 'named-1', displayName: 'Aunt Huda', rsvp: 'going', invitedBy: A, invitedAt: '1970-01-01T00:00:02.000Z' }],
      schedule: [
        { id: 's1', startsAt: '2030-01-01T18:00:00Z', title: 'Dinner' },
        { id: 's2', startsAt: '2030-01-01T17:00:00Z', title: 'Hosts arrive', visibility: 'hosts_only' },
      ],
    },
    members: [member(A, 'host', 1, ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'schedule.edit'])],
    invitees: [invitee(B, 'accepted'), invitee(C, 'pending')],
    ...overrides,
  });
}

describe('plan relation and projection', () => {
  it('decides relation from membership and invitations only', () => {
    const h = plan({ invitees: [invitee(B, 'pending'), invitee(C, 'declined')] });
    expect(relationOf(h, A)).toBe('member');
    expect(relationOf(h, B)).toBe('invited');
    expect(relationOf(h, C)).toBe('none');
    expect(relationOf(h, D)).toBe('none');
    expect(relationOf(event(), C)).toBe('guest'); // event guests see the guest view whatever they answered
    expect(projectFor(h, D)).toBeNull();
  });

  it('shows hangout invitations with the app’s wording', () => {
    const doc = projectFor(plan({ invitees: [invitee(B, 'accepted'), invitee(C, 'pending')] }), A)!;
    expect(doc.type === 'hangout' && doc.invites?.map((i) => [i.personId, i.status])).toEqual([[B, 'in'], [C, 'pending']]);
  });

  it('strips the event for a guest on the server: no host-only items, no other guests, no co-host settings', () => {
    const host = projectFor(event(), A) as VoyaEvent;
    expect(host.guests.map((g) => g.displayName)).toEqual(['Person b', 'Person c', 'Aunt Huda']);
    expect(host.schedule).toHaveLength(2);
    expect(host.cohostPermissions).toBeDefined();

    const guest = projectFor(event(), B) as VoyaEvent;
    expect(PlanSchema.parse(guest)).toEqual(guest);
    expect(guest.viewerGuestId).toBe('b-guest');
    expect(guest.schedule.map((s) => s.id)).toEqual(['s1']);
    expect(guest.cohostPermissions).toBeUndefined();
    expect(guest.guests.every((g) => g.personId === undefined)).toBe(true);
    expect(guest.guests.map((g) => g.displayName)).toEqual(['Person b', '', '']);
    expect(guest.guests.map((g) => g.rsvp)).toEqual(['going', 'pending', 'going']); // counts still work
  });

  it('classifies timing like the app: lifecycle first, then the end (or start) time', () => {
    const now = Date.parse('2030-01-02T00:00:00Z');
    expect(timingOf({ lifecycle: 'active', startsAt: new Date('2030-01-01T18:00:00Z'), endsAt: null }, now)).toBe('past');
    expect(timingOf({ lifecycle: 'active', startsAt: new Date('2030-01-01T18:00:00Z'), endsAt: new Date('2030-01-03T00:00:00Z') }, now)).toBe('upcoming');
    expect(timingOf({ lifecycle: 'cancelled', startsAt: new Date('2031-01-01T00:00:00Z'), endsAt: null }, now)).toBe('past');
    expect(timingOf({ lifecycle: 'draft', startsAt: null, endsAt: null }, now)).toBe('upcoming');
  });
});

describe('taking a person off a plan', () => {
  it('hands a leaving organizer’s plan to the member who joined next, with the organizer role', () => {
    const h = plan({
      members: [member(A, 'organizer', 1, ['plan.edit', 'invite.create']), member(C, 'participant', 3, ['vote.cast']), member(B, 'participant', 2, ['vote.cast'])].sort(
        (x, y) => x.joinedAt.getTime() - y.joinedAt.getTime(),
      ),
      invitees: [invitee(B, 'accepted'), invitee(C, 'accepted')],
      details: {
        template: 'Dinner', finalized: false, timeline: [], changeRequests: [],
        suggestions: [{ id: 'sg', placeId: 'x', slot: 'Dinner', suggestedBy: A, votes: { [A]: 'up', [B]: 'up' } }],
      },
    });
    const r = removePerson(h, A, false);
    expect(r.kind).toBe('updated');
    if (r.kind !== 'updated') return;
    expect(r.heir).toEqual({ profileId: B, role: 'organizer', capabilities: ['vote.cast', 'plan.edit', 'invite.create'] });
    expect(r.dropInviteeOf).toEqual([B]); // the organizer has no invitation of their own
    const sg = (r.details.suggestions as { suggestedBy: string; votes: object }[])[0]!;
    expect(sg.votes).toEqual({ [B]: 'up' });
    expect(sg.suggestedBy).toBe(A); // leaving keeps the suggestion credited
    expect(h.details.suggestions).toEqual([expect.objectContaining({ votes: { [A]: 'up', [B]: 'up' } })]); // input untouched
  });

  it('credits a deleted account’s suggestions to a former member', () => {
    const h = plan({
      members: [member(B, 'organizer', 1)], ownerId: B,
      details: { template: 'Dinner', suggestions: [{ id: 'sg', placeId: 'x', slot: 'Dinner', suggestedBy: A, votes: { [A]: 'up' } }], finalized: false, timeline: [], changeRequests: [{ id: 'c', slot: 'Dinner', by: A, at: 'x' }] },
    });
    const r = removePerson(h, A, true);
    expect(r.kind === 'updated' && r.details).toMatchObject({
      suggestions: [{ suggestedBy: FORMER_MEMBER, votes: {} }],
      changeRequests: [{ by: FORMER_MEMBER }],
    });
  });

  it('deletes a plan with nobody left, but keeps an event that still has guests while its owner exists', () => {
    expect(removePerson(plan({}), A, false).kind).toBe('plan_deleted');
    const e = removePerson(event(), A, false);
    expect(e).toMatchObject({ kind: 'updated', dropInviteeOf: [] });
    expect(e.kind === 'updated' && e.heir).toBeUndefined();
    expect(removePerson(event(), A, true).kind).toBe('plan_deleted'); // nobody could ever manage it
  });

  it('leaves plans that do not involve the person alone', () => {
    expect(removePerson(plan({}), D, true).kind).toBe('untouched');
  });

  it('forgets a traveler’s trip inputs; a must-do only they wanted goes too', () => {
    const details = {
      mustDoPlaceIds: ['p1', 'p2'], mustDoBy: { p1: [A], p2: [A, B] },
      preferences: { [A]: {}, [B]: {} }, picks: { [A]: { p1: 'must' } }, doneChoosing: [A, B],
      days: [{ date: '2030-01-01', items: [{ id: 'i', replaceRequests: [{ id: 'r', by: A, at: 'x' }, { id: 'r2', by: B, at: 'x' }] }] }],
    };
    expect(forgetInDetails('trip', details, A, false)).toEqual({
      mustDoPlaceIds: ['p2'], mustDoBy: { p2: [B] }, preferences: { [B]: {} }, picks: {}, doneChoosing: [B],
      days: [{ date: '2030-01-01', items: [{ id: 'i', replaceRequests: [{ id: 'r2', by: B, at: 'x' }] }] }],
    });
  });
});

describe('seed translation', () => {
  const people = new Map(fixtures.people.map((p, i) => [p.id, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`]));
  const places = new Map(fixtures.places.map((p, i) => [p.id, `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`]));
  const lookup = (map: Map<string, string>) => (ref: string) => {
    const id = map.get(ref);
    if (!id) throw new Error(`unknown ${ref}`);
    return id;
  };

  it.each(fixtures.plans.map((p) => [p.id, p] as const))('%s keeps no fixture refs and projects to a valid plan', (_id, fixture) => {
    const { type, members, ownerId, version, title, city, lifecycle, startsAt, endsAt, startDate, endDate, ...rest } =
      fixture as Record<string, unknown> & { type: 'trip' | 'hangout' | 'event' };
    delete rest.id;
    const { details, invitees } = translatePlan(type, rest, lookup(people), lookup(places));
    const text = JSON.stringify(details);
    for (const ref of [...people.keys(), ...places.keys()]) expect(text).not.toContain(`"${ref}"`);
    const owner = people.get(ownerId as string)!;
    const state: PlanState = {
      id: '00000000-0000-4000-8000-0000000000f2', type, title: title as string, city: city as string,
      lifecycle: lifecycle as PlanState['lifecycle'], ownerId: owner, version: version as number,
      startsAt: startsAt ? new Date(startsAt as string) : null, endsAt: endsAt ? new Date(endsAt as string) : null,
      startDate: startDate ? new Date(`${startDate as string}T00:00:00Z`) : null, endDate: endDate ? new Date(`${endDate as string}T00:00:00Z`) : null,
      details,
      members: (members as { personId: string; role: MemberState['role']; capabilities: MemberState['capabilities']; joinedAt: string }[]).map((m) =>
        member(people.get(m.personId)!, m.role, Date.parse(m.joinedAt), m.capabilities)),
      invitees: invitees.map((i, n) => ({ ...invitee(i.profileId, i.status, `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`), invitedById: i.invitedById })),
    };
    expect(projectFor(state, owner)).not.toBeNull();
  });
});

describe('templates and preconditions', () => {
  it('knows the app’s hangout templates', () => {
    expect(Object.keys(HANGOUT_TEMPLATE_SLOTS)).toContain('Dinner + Activity + Dessert');
  });

  it('parses If-Match versions', () => {
    expect(parseIfMatch(undefined)).toBeUndefined();
    expect(parseIfMatch('*')).toBeUndefined();
    expect(parseIfMatch('4')).toBe(4);
    expect(parseIfMatch('"4"')).toBe(4);
    expect(parseIfMatch('W/"12"')).toBe(12);
    expect(() => parseIfMatch('abc')).toThrow();
  });
});
