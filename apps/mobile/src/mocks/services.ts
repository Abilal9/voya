import type {
  AuthService,
  AuthSession,
  CatalogService,
  EventsService,
  HangoutsService,
  InvitationsService,
  NotificationsService,
  PlacesQuery,
  PlacesService,
  PlansService,
  ProfileService,
  SavedService,
  Services,
  TripsService,
} from '@/services/contracts';
import {
  ServiceError,
  type Hangout,
  type ID,
  type Invitation,
  type Place,
  type Plan,
  type RSVP,
  type TimelineItem,
  type Trip,
  type VoyaEvent,
} from '@/services/types';
import { classifyPlan, sortPast, sortUpcoming } from '@/services/planRules';
import * as fx from './fixtures';
import {
  currentAccountId,
  mutate,
  peek,
  read,
  resetAll,
  setCurrentAccountId,
} from './store';

/**
 * Local mock implementations of every service contract.
 *
 * These are SIMULATED. Nothing here is secure, nothing talks to a network, and
 * none of it should be mistaken for server-side authorisation. The permission
 * checks below exist so the UI exercises the right branches — the real checks
 * happen on the server in a later milestone.
 */

const DEV_VERIFICATION_CODE = '424242';

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function requirePlan<T extends Plan>(plans: Plan[], id: ID, type: T['type']): T {
  const plan = plans.find((p) => p.id === id);
  if (!plan) throw new ServiceError('not_found', 'Plan not found.', false);
  if (plan.type !== type) throw new ServiceError('wrong_type', 'Unexpected plan type.', false);
  return plan as T;
}

function can(plan: Plan, personId: ID, capability: string): boolean {
  const member = plan.members.find((m) => m.personId === personId);
  return !!member?.capabilities.includes(capability as never);
}

// ---------------------------------------------------------------- auth

const auth: AuthService = {
  async getSession() {
    const id = await currentAccountId();
    if (!id) return null;
    const person = fx.people.find((p) => p.id === id);
    return { accountId: id, email: `${person?.firstName.toLowerCase() ?? 'user'}@example.com` };
  },
  async signIn(email) {
    const person =
      fx.people.find((p) => `${p.firstName.toLowerCase()}@example.com` === email.toLowerCase()) ??
      fx.people[0]!;
    await setCurrentAccountId(person.id);
    return { accountId: person.id, email } satisfies AuthSession;
  },
  async signUp(email) {
    await setCurrentAccountId(fx.SIGNED_IN_ACCOUNT_ID);
    return { accountId: fx.SIGNED_IN_ACCOUNT_ID, email };
  },
  async verifyEmailCode(code) {
    if (code !== DEV_VERIFICATION_CODE) {
      throw new ServiceError('bad_code', 'That code is not correct.', true);
    }
  },
  async requestPasswordReset() {
    // The frozen design sends a reset LINK here (A04 → A05). Nothing is emailed.
  },
  async setNewPassword() {
    // No credential is ever stored by the mock.
  },
  async signInWithApple() {
    await setCurrentAccountId(fx.SIGNED_IN_ACCOUNT_ID);
    return { accountId: fx.SIGNED_IN_ACCOUNT_ID, email: 'ahmad@privaterelay.example.com' };
  },
  async signInWithGoogle() {
    await setCurrentAccountId(fx.SIGNED_IN_ACCOUNT_ID);
    return { accountId: fx.SIGNED_IN_ACCOUNT_ID, email: 'ahmad@example.com' };
  },
  async signOut() {
    await setCurrentAccountId(null);
  },
};

// ------------------------------------------------------------- profile

const profile: ProfileService = {
  async getAccount() {
    const { state } = await read();
    return state.account;
  },
  updateProfile: (patch) => mutate((s) => Object.assign(s.account, patch)),
  setInterests: (interests) =>
    mutate((s) => {
      s.account.interests = interests;
      return s.account;
    }),
  completeOnboardingStep: (step) =>
    mutate((s) => {
      const order = ['profile', 'interests', 'location', 'notifications', 'done'] as const;
      const next = order[Math.min(order.indexOf(step) + 1, order.length - 1)]!;
      s.account.onboardingStep = next;
      s.account.onboardingComplete = next === 'done';
      return s.account;
    }),
};

// -------------------------------------------------------------- places

function rank(places: Place[], q: PlacesQuery): Place[] {
  return places
    .filter((p) => !p.permanentlyClosed)
    .filter((p) => (q.city ? p.city === q.city : true))
    .filter((p) => (q.category && q.category !== 'All' ? p.category === q.category : true))
    .filter((p) => (q.openNow ? p.openNow === true : true))
    .filter((p) => (q.tags?.length ? q.tags.every((t) => p.tags?.includes(t)) : true))
    .filter((p) =>
      q.query ? p.name.toLowerCase().includes(q.query.toLowerCase()) : true,
    )
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}

const places: PlacesService = {
  async discover(q) {
    const { state } = await read();
    const disliked = new Set(
      Object.entries(state.signals)
        .filter(([, v]) => v === 'dislike')
        .map(([k]) => k),
    );
    return rank(fx.places, q).filter((p) => !disliked.has(p.id));
  },
  async search(query, city) {
    await read();
    if (!query.trim()) return [];
    return rank(fx.places, { query, city });
  },
  async getPlace(id) {
    await read();
    const place = fx.places.find((p) => p.id === id);
    if (!place) throw new ServiceError('not_found', 'Place not found.', false);
    return place;
  },
  setSignal: (placeId, signal) =>
    mutate((s) => {
      if (signal === 'none') delete s.signals[placeId];
      else s.signals[placeId] = signal;
    }),
};

// --------------------------------------------------------------- saved

const saved: SavedService = {
  async list() {
    const { state } = await read();
    return [...state.saved].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  async isSaved(placeId) {
    const snapshot = await peek();
    return !!snapshot?.state.saved.some((s) => s.placeId === placeId);
  },
  save: (placeId) =>
    mutate((s) => {
      if (!s.saved.some((x) => x.placeId === placeId)) {
        s.saved.push({ placeId, savedAt: new Date().toISOString() });
      }
    }),
  unsave: (placeId) =>
    mutate((s) => {
      s.saved = s.saved.filter((x) => x.placeId !== placeId);
    }),
};

// --------------------------------------------------------------- plans

const plans: PlansService = {
  async listUpcoming() {
    const { state } = await read();
    const now = Date.now();
    return state.plans.filter((p) => classifyPlan(p, now) === 'upcoming').sort(sortUpcoming);
  },
  async listPast() {
    const { state } = await read();
    const now = Date.now();
    return state.plans.filter((p) => classifyPlan(p, now) === 'past').sort(sortPast);
  },
  async get(id) {
    const { state } = await read();
    const plan = state.plans.find((p) => p.id === id);
    if (!plan) throw new ServiceError('not_found', 'Plan not found.', false);
    return plan;
  },
  createTrip: (input) =>
    mutate((s) => {
      const trip: Trip = {
        id: uid('plan'), type: 'trip', title: input.title, destination: input.destination,
        city: input.destination, lifecycle: 'active', ownerId: s.account.id, version: 1,
        startsAt: input.startsAt, endsAt: input.endsAt, generated: false,
        mustDoPlaceIds: [], days: [],
        members: [{
          personId: s.account.id, role: 'organizer',
          capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create'],
          joinedAt: new Date().toISOString(),
        }],
      };
      s.plans.push(trip);
      return trip;
    }),
  createHangout: (input) =>
    mutate((s) => {
      const hangout: Hangout = {
        id: uid('plan'), type: 'hangout', title: input.title, city: input.city,
        lifecycle: 'active', ownerId: s.account.id, version: 1, startsAt: input.startsAt,
        template: input.template, finalized: false, suggestions: [], timeline: [],
        members: [{
          personId: s.account.id, role: 'organizer',
          capabilities: ['plan.edit', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'],
          joinedAt: new Date().toISOString(),
        }],
      };
      s.plans.push(hangout);
      return hangout;
    }),
  createEvent: (input) =>
    mutate((s) => {
      const event: VoyaEvent = {
        id: uid('plan'), type: 'event', title: input.title, city: input.city,
        lifecycle: 'active', ownerId: s.account.id, version: 1, startsAt: input.startsAt,
        venue: input.venue, guests: [], schedule: [],
        members: [{
          personId: s.account.id, role: 'host',
          capabilities: ['plan.edit', 'member.manage', 'invite.create', 'schedule.edit'],
          joinedAt: new Date().toISOString(),
        }],
      };
      s.plans.push(event);
      return event;
    }),
  leave: (id) =>
    mutate((s) => {
      s.plans = s.plans.filter((p) => p.id !== id);
    }),
};

// --------------------------------------------------------- invitations

const INVITES: Record<string, Invitation> = {
  [fx.INVITE_TOKENS.validHangout]: {
    token: fx.INVITE_TOKENS.validHangout, planId: 'plan-friday', planType: 'hangout',
    planTitle: 'Friday Night', inviterName: 'Ahmad', role: 'participant',
  },
  [fx.INVITE_TOKENS.validEvent]: {
    token: fx.INVITE_TOKENS.validEvent, planId: 'plan-wedding', planType: 'event',
    planTitle: "Ahmad & Nisreen's Wedding", inviterName: 'Ahmad', role: 'guest',
  },
  [fx.INVITE_TOKENS.expired]: {
    token: fx.INVITE_TOKENS.expired, planId: 'plan-friday', planType: 'hangout',
    planTitle: 'Friday Night', inviterName: 'Ahmad', role: 'participant', expired: true,
  },
  [fx.INVITE_TOKENS.revoked]: {
    token: fx.INVITE_TOKENS.revoked, planId: 'plan-friday', planType: 'hangout',
    planTitle: 'Friday Night', inviterName: 'Ahmad', role: 'participant', revoked: true,
  },
};

const invitations: InvitationsService = {
  async resolve(token) {
    const invite = INVITES[token];
    if (!invite) throw new ServiceError('invalid_invite', 'This invitation link is not valid.', false);
    return invite;
  },
  /** Idempotent, mirroring the real acceptance transaction: a repeat is not an error. */
  accept: (token) =>
    mutate((s) => {
      const invite = INVITES[token];
      if (!invite) throw new ServiceError('invalid_invite', 'This invitation link is not valid.', false);
      if (invite.expired) throw new ServiceError('expired', 'This invitation has expired.', false);
      if (invite.revoked) throw new ServiceError('revoked', 'This invitation was revoked.', false);

      const plan = s.plans.find((p) => p.id === invite.planId) ?? fx.plans.find((p) => p.id === invite.planId);
      if (!plan) throw new ServiceError('not_found', 'That plan no longer exists.', false);

      if (!s.plans.some((p) => p.id === plan.id)) s.plans.push(structuredClone(plan));
      const joined = s.plans.find((p) => p.id === invite.planId)!;
      if (joined.members.some((m) => m.personId === s.account.id)) {
        return { planId: joined.id, alreadyMember: true };
      }
      joined.members.push({
        personId: s.account.id, role: invite.role,
        capabilities: invite.role === 'guest' ? ['rsvp.own'] : ['suggestion.create', 'vote.cast'],
        joinedAt: new Date().toISOString(),
      });
      joined.version += 1;
      return { planId: joined.id, alreadyMember: false };
    }),
  async createForPlan(planId) {
    const { state } = await read();
    const plan = state.plans.find((p) => p.id === planId);
    if (!plan) throw new ServiceError('not_found', 'Plan not found.', false);
    return {
      token: uid('inv'), planId, planType: plan.type, planTitle: plan.title,
      inviterName: state.account.displayName,
      role: plan.type === 'event' ? 'guest' : 'participant',
    };
  },
};

// ------------------------------------------------------------ hangouts

const hangouts: HangoutsService = {
  suggestPlace: (id, placeId, slot) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout');
      if (h.suggestions.some((x) => x.placeId === placeId && x.slot === slot)) {
        throw new ServiceError('duplicate', 'That place is already suggested for this slot.', false);
      }
      h.suggestions.push({ id: uid('sg'), placeId, slot, suggestedBy: s.account.id, votes: {} });
      h.version += 1;
      return h;
    }),
  vote: (id, suggestionId, value) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout');
      if (!can(h, s.account.id, 'vote.cast')) {
        throw new ServiceError('forbidden', 'You cannot vote on this hangout.', false);
      }
      const sg = h.suggestions.find((x) => x.id === suggestionId);
      if (!sg) throw new ServiceError('not_found', 'Suggestion not found.', false);
      sg.votes[s.account.id] = value; // one vote per participant per suggestion
      h.version += 1;
      return h;
    }),
  simulateParticipantVotes: (id) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout');
      const others = h.members.map((m) => m.personId).filter((p) => p !== s.account.id);
      h.suggestions.forEach((sg, i) => {
        const voter = others[i % Math.max(others.length, 1)];
        if (voter) sg.votes[voter] = i % 3 === 0 ? 'down' : 'up';
      });
      h.version += 1;
      return h;
    }),
  finalize: (id) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout');
      if (!can(h, s.account.id, 'timeline.finalize')) {
        throw new ServiceError('forbidden', 'Only the organiser can finalise.', false);
      }
      const slots = [...new Set(h.suggestions.map((x) => x.slot))];
      const start = new Date(h.startsAt ?? new Date().toISOString());
      h.timeline = slots.map((slot, i) => {
        const winner = h.suggestions
          .filter((x) => x.slot === slot)
          .sort(
            (a, b) =>
              Object.values(b.votes).filter((v) => v === 'up').length -
              Object.values(a.votes).filter((v) => v === 'up').length,
          )[0];
        const at = new Date(start.getTime() + i * 2 * 60 * 60 * 1000);
        const place = fx.places.find((p) => p.id === winner?.placeId);
        return {
          id: uid('tl'), startsAt: at.toISOString(), title: slot,
          subtitle: place?.name, placeId: winner?.placeId,
        } satisfies TimelineItem;
      });
      h.finalized = true;
      h.version += 1;
      return h;
    }),
  proposeChange: (id, itemId, placeId) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout');
      const item = h.timeline.find((x) => x.id === itemId);
      if (!item) throw new ServiceError('not_found', 'Timeline item not found.', false);
      const place = fx.places.find((p) => p.id === placeId);
      item.placeId = placeId;
      item.subtitle = place?.name;
      h.version += 1;
      return h;
    }),
};

// -------------------------------------------------------------- events

const events: EventsService = {
  setRsvp: (eventId, guestId, rsvp: RSVP) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event');
      const guest = e.guests.find((g) => g.id === guestId);
      if (!guest) throw new ServiceError('not_found', 'Guest not found.', false);
      guest.rsvp = rsvp; // one RSVP row per guest
      e.version += 1;
      return e;
    }),
  addGuest: (eventId, displayName) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event');
      if (!can(e, s.account.id, 'member.manage')) {
        throw new ServiceError('forbidden', 'Only hosts can manage guests.', false);
      }
      e.guests.push({ id: uid('g'), displayName, rsvp: 'pending' });
      e.version += 1;
      return e;
    }),
  upsertScheduleItem: (eventId, item) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event');
      if (!can(e, s.account.id, 'schedule.edit')) {
        throw new ServiceError('forbidden', 'Only hosts can edit the schedule.', false);
      }
      const existing = item.id ? e.schedule.find((x) => x.id === item.id) : undefined;
      if (existing) Object.assign(existing, item);
      else {
        e.schedule.push({
          id: uid('ev'),
          startsAt: item.startsAt ?? new Date().toISOString(),
          title: item.title ?? 'New item',
          subtitle: item.subtitle,
          visibility: item.visibility ?? 'all_guests',
        });
      }
      e.schedule.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      e.version += 1;
      return e;
    }),
  removeScheduleItem: (eventId, itemId) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event');
      if (!can(e, s.account.id, 'schedule.edit')) {
        throw new ServiceError('forbidden', 'Only hosts can edit the schedule.', false);
      }
      e.schedule = e.schedule.filter((x) => x.id !== itemId);
      e.version += 1;
      return e;
    }),
  /**
   * Host-only content is stripped here, exactly as the server will strip it.
   * Filtering in the UI instead would be a disclosure bug waiting to happen.
   */
  async guestProjection(eventId) {
    const { state } = await read();
    const e = requirePlan<VoyaEvent>(state.plans, eventId, 'event');
    const projected = structuredClone(e) as VoyaEvent;
    projected.schedule = projected.schedule.filter((i) => i.visibility !== 'hosts_only');
    projected.guests = projected.guests.map((g) => ({ ...g, personId: undefined }));
    return projected;
  },
};

// --------------------------------------------------------------- trips

const trips: TripsService = {
  setMustDo: (tripId, placeId, on) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip');
      t.mustDoPlaceIds = on
        ? [...new Set([...t.mustDoPlaceIds, placeId])]
        : t.mustDoPlaceIds.filter((x) => x !== placeId);
      t.version += 1;
      return t;
    }),
  /** Fixture-backed. NOT the production scheduler. */
  generateItinerary: (tripId) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip');
      if (t.days.length === 0) {
        const pool = fx.places.filter((p) => p.city === t.destination && !p.permanentlyClosed);
        const must = t.mustDoPlaceIds
          .map((id) => fx.places.find((p) => p.id === id))
          .filter(Boolean) as Place[];
        const ordered = [...must, ...pool.filter((p) => !t.mustDoPlaceIds.includes(p.id))];
        const start = new Date(t.startsAt ?? new Date().toISOString());
        const dayCount = 2;
        t.days = Array.from({ length: dayCount }, (_, d) => {
          const date = new Date(start.getTime() + d * 86400000);
          const slice = ordered.slice(d * 3, d * 3 + 3);
          return {
            date: date.toISOString().slice(0, 10),
            items: slice.map((place, i) => ({
              id: uid('it'),
              startsAt: new Date(date.getTime() + (10 + i * 4) * 3600000).toISOString(),
              title: place.name,
              subtitle: place.type,
              placeId: place.id,
              locked: t.mustDoPlaceIds.includes(place.id),
              travelMinutes: i === 0 ? 0 : 8 + i * 3,
            })),
          };
        });
      }
      t.generated = true;
      t.version += 1;
      return t;
    }),
  toggleLock: (tripId, itemId) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip');
      for (const day of t.days) {
        const item = day.items.find((i) => i.id === itemId);
        if (item) item.locked = !item.locked;
      }
      t.version += 1;
      return t;
    }),
  replaceItem: (tripId, itemId, placeId) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip');
      const place = fx.places.find((p) => p.id === placeId);
      for (const day of t.days) {
        const item = day.items.find((i) => i.id === itemId);
        if (item) {
          if (item.locked) {
            throw new ServiceError('locked', 'Unlock this item before replacing it.', false);
          }
          item.placeId = placeId;
          item.title = place?.name ?? item.title;
          item.subtitle = place?.type;
        }
      }
      t.version += 1;
      return t;
    }),
};

// ------------------------------------------------------- notifications

const notifications: NotificationsService = {
  async list() {
    const { state } = await read();
    return [...state.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  markAllRead: () =>
    mutate((s) => {
      const now = new Date().toISOString();
      s.activity = s.activity.map((a) => ({ ...a, readAt: a.readAt ?? now }));
    }),
  async unreadCount() {
    const snapshot = await peek();
    return snapshot?.state.activity.filter((a) => !a.readAt).length ?? 0;
  },
};

const catalog: CatalogService = {
  async cities() {
    return [...fx.CITIES];
  },
  async interests() {
    return [...fx.INTERESTS];
  },
  async people() {
    return structuredClone(fx.people);
  },
};

export const mockServices: Services = {
  auth, profile, places, saved, plans, invitations, hangouts, events, trips, notifications, catalog,
};

export const devTools = { resetAll, setCurrentAccountId };
