import {
  AcceptInvitationResponseSchema,
  CreatedInvitationSchema,
  InvitationSchema,
  MutedPlansSchema,
  PeopleListSchema,
  PlanSchema,
  PlansListSchema,
  RespondToInvitationResponseSchema,
  type UpdatePlanRequest,
} from '@voya/contracts';
import type {
  CatalogService,
  EventsService,
  HangoutsService,
  InvitationsService,
  PlansService,
  TripsService,
} from '@/services/contracts';
import { ServiceError, type Hangout, type ID, type Plan, type Trip, type VoyaEvent } from '@/services/types';
import type { ApiClient } from './http';

/**
 * Real-mode plans (B2): the shared plan, its people and its invitations come
 * from the Voya API, which decides who may see and do what. Nothing here
 * falls back to the phone's mock plans.
 *
 * The experience-specific collaboration (hangout suggestions and votes,
 * event schedules and co-hosts, trip preferences and itineraries) is B3. In
 * real mode those actions refuse with `not_available` and say so, rather than
 * changing a local copy that nobody else would see. Mock mode is untouched.
 *
 * Writes send the version this phone last saw as `If-Match`, so an edit made
 * on a stale screen is refused (`conflict`) instead of overwriting someone
 * else's change.
 */

export const notYetShared = (what: string) =>
  new ServiceError('not_available', `${what} isn’t available for shared plans yet.`, false);

const refuse = (what: string) => async (): Promise<never> => {
  throw notYetShared(what);
};

export interface RealPlanServices {
  plans: PlansService;
  invitations: InvitationsService;
  hangouts: HangoutsService;
  events: EventsService;
  trips: TripsService;
  people: CatalogService['people'];
  mutedPlans(): Promise<ID[]>;
  setMutedPlans(ids: ID[]): Promise<ID[]>;
  /** Forget what this phone saw (sign-out, account switch). */
  reset(): void;
}

export function createRealPlanServices(api: ApiClient): RealPlanServices {
  /** The last version and document seen per plan (for If-Match, and for answers that hide the plan). */
  const seen = new Map<ID, Plan>();

  const keep = <T extends Plan>(plan: T): T => {
    seen.set(plan.id, plan);
    return plan;
  };
  const ifMatch = (id: ID) => {
    const version = seen.get(id)?.version;
    return version === undefined ? undefined : { 'if-match': String(version) };
  };
  const fetchPlan = async (id: ID) => keep((await api.call('GET', `/plans/${id}`, PlanSchema)) as Plan);
  /** Edits need the version the person is looking at; fetch it only if this phone never saw the plan. */
  const versioned = async (id: ID) => {
    if (!seen.has(id)) await fetchPlan(id);
    return ifMatch(id);
  };

  const ofType = <T extends Plan>(plan: Plan, type: T['type']): T => {
    if (plan.type !== type) throw new ServiceError('wrong_type', 'Unexpected plan type.', false);
    return plan as T;
  };
  const patch = async <T extends Plan>(id: ID, type: T['type'], body: UpdatePlanRequest) =>
    ofType<T>(keep((await api.call('PATCH', `/plans/${id}`, PlanSchema, body, await versioned(id))) as Plan), type);
  const invite = async <T extends Plan>(id: ID, type: T['type'], personIds: ID[]) =>
    ofType<T>(keep((await api.call('POST', `/plans/${id}/invitees`, PlanSchema, { personIds: [...new Set(personIds)] })) as Plan), type);
  const respond = async <T extends Plan>(id: ID, type: T['type'], answer: 'accept' | 'maybe' | 'decline') => {
    const { plan } = await api.call('POST', `/plans/${id}/response`, RespondToInvitationResponseSchema, { answer });
    if (plan) return ofType<T>(keep(plan as Plan), type);
    // Declined: the plan is no longer visible to this person. Hand back what the screen had.
    const last = seen.get(id);
    seen.delete(id);
    if (!last) throw new ServiceError('not_found', 'Plan not found.', false);
    return ofType<T>(last, type);
  };
  const removePerson = async <T extends Plan>(id: ID, type: T['type'], personId: ID) =>
    ofType<T>(keep((await api.call('DELETE', `/plans/${id}/people/${personId}`, PlanSchema, undefined, await versioned(id))) as Plan), type);
  const removePlan = async (id: ID) => {
    await api.call('DELETE', `/plans/${id}`, null, undefined, await versioned(id));
    seen.delete(id);
  };

  // ------------------------------------------------------------------ plans

  const plans: PlansService = {
    async listUpcoming() {
      return (await api.call('GET', '/plans?timing=upcoming', PlansListSchema)).items.map((p) => keep(p as Plan));
    },
    async listPast() {
      return (await api.call('GET', '/plans?timing=past', PlansListSchema)).items.map((p) => keep(p as Plan));
    },
    get: fetchPlan,
    async createHangout(input) {
      const body = { title: input.title, city: input.city, template: input.template, startsAt: input.startsAt, invitees: input.invitees };
      return keep((await api.call('POST', '/plans/hangouts', PlanSchema, body)) as Hangout);
    },
    async createEvent(input) {
      if (input.coverUri) throw notYetShared('A cover photo');
      const body = {
        title: input.title, venue: input.venue, startsAt: input.startsAt,
        ...(input.city ? { city: input.city } : {}),
        ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.hosts?.length ? { hosts: input.hosts } : {}),
      };
      return keep((await api.call('POST', '/plans/events', PlanSchema, body)) as VoyaEvent);
    },
    async leave(id) {
      await api.call('POST', `/plans/${id}/leave`, null, undefined, ifMatch(id));
      seen.delete(id);
    },
    addTargets: refuse('Adding places to a plan'),
    addPlace: refuse('Adding places to a plan'),
  };

  // ------------------------------------------------------------ invitations

  const invitations: InvitationsService = {
    async resolve(token) {
      try {
        return await api.call('POST', '/invitations/resolve', InvitationSchema, { token });
      } catch (e) {
        if (e instanceof ServiceError && (e.code === 'not_found' || e.code === 'validation_failed')) {
          throw new ServiceError('invalid_invite', 'This invitation link is not valid.', false);
        }
        throw e;
      }
    },
    async accept(token) {
      return api.call('POST', '/invitations/accept', AcceptInvitationResponseSchema, { token });
    },
    async createForPlan(planId) {
      return (await api.call('POST', `/plans/${planId}/invitations`, CreatedInvitationSchema, {})).invitation;
    },
  };

  // --------------------------------------------------------------- hangouts

  const hangouts: HangoutsService = {
    update: (id, p) => patch<Hangout>(id, 'hangout', p),
    invite: (id, personIds) => invite<Hangout>(id, 'hangout', personIds),
    respond: (id, r) => respond<Hangout>(id, 'hangout', r === 'in' ? 'accept' : r === 'maybe' ? 'maybe' : 'decline'),
    removePerson: (id, personId) => removePerson<Hangout>(id, 'hangout', personId),
    remove: removePlan,
    suggestPlace: refuse('Suggesting places'),
    vote: refuse('Voting'),
    voteForPlace: refuse('Voting'),
    simulateParticipantVotes: refuse('Simulated votes'),
    finalize: refuse('Finalizing'),
    proposeChange: refuse('Suggesting a change'),
  };

  // ----------------------------------------------------------------- events

  const events: EventsService = {
    async update(id, p) {
      if (p.coverUri !== undefined) throw notYetShared('A cover photo');
      const body: UpdatePlanRequest = {};
      if (p.title !== undefined) body.title = p.title;
      if (p.venue !== undefined) body.venue = p.venue;
      if (p.city !== undefined && p.city.trim()) body.city = p.city;
      if (p.description !== undefined) body.description = p.description.trim() || null;
      if (p.startsAt !== undefined) body.startsAt = new Date(p.startsAt).toISOString();
      if (p.endsAt !== undefined) {
        if (!p.endsAt) body.endsAt = null;
        else {
          // 7:00 PM – 1:00 AM: an end before the start runs past midnight (as the app's form means it).
          const start = Date.parse(p.startsAt ?? seen.get(id)?.startsAt ?? '');
          let end = Date.parse(p.endsAt);
          if (!Number.isNaN(start)) while (end <= start) end += 86_400_000;
          body.endsAt = new Date(end).toISOString();
        }
      }
      return patch<VoyaEvent>(id, 'event', body);
    },
    respond: (id, rsvp) => respond<VoyaEvent>(id, 'event', rsvp === 'going' ? 'accept' : rsvp === 'maybe' ? 'maybe' : 'decline'),
    invite: (id, personIds) => invite<VoyaEvent>(id, 'event', personIds),
    async removeGuest(id, guestId) {
      const event = seen.get(id) ?? (await fetchPlan(id));
      const guest = event.type === 'event' ? event.guests.find((g) => g.id === guestId) : undefined;
      if (!guest) throw new ServiceError('not_found', 'Guest not found.', false);
      if (!guest.personId) throw notYetShared('Guests added by name');
      return removePerson<VoyaEvent>(id, 'event', guest.personId);
    },
    async cancel(id) {
      return ofType<VoyaEvent>(keep((await api.call('POST', `/plans/${id}/cancel`, PlanSchema, undefined, await versioned(id))) as Plan), 'event');
    },
    /** The server already projects the event for whoever asks. */
    guestProjection: async (id) => ofType<VoyaEvent>(await fetchPlan(id), 'event'),
    setRsvp: refuse('Answering for a guest'),
    addGuest: refuse('Guests added by name'),
    upsertScheduleItem: refuse('The schedule'),
    removeScheduleItem: refuse('The schedule'),
    saveSchedule: refuse('The schedule'),
    addCohosts: refuse('Co-hosts'),
    setHostRole: refuse('Co-hosts'),
    removeHost: refuse('Co-hosts'),
    setCohostPermissions: refuse('Co-host permissions'),
  };

  // ------------------------------------------------------------------ trips

  const trips: TripsService = {
    async create(input) {
      const body = { destination: input.destination, startDate: input.startDate, endDate: input.endDate, ...(input.title?.trim() ? { title: input.title.trim() } : {}) };
      return keep((await api.call('POST', '/plans/trips', PlanSchema, body)) as Trip);
    },
    async update(id, p) {
      if (p.coverUri !== undefined) throw notYetShared('A cover photo');
      const current = seen.get(id);
      if (p.destination !== undefined && current?.type === 'trip' && p.destination.trim().toLowerCase() !== current.destination.toLowerCase()) {
        throw notYetShared('Changing the destination');
      }
      const body: UpdatePlanRequest = {};
      if (p.title !== undefined) body.title = p.title;
      if (p.startDate !== undefined) body.startDate = p.startDate;
      if (p.endDate !== undefined) body.endDate = p.endDate;
      if (p.accommodation !== undefined) body.accommodation = p.accommodation.trim() || null;
      if (Object.keys(body).length === 0) return ofType<Trip>(current ?? (await fetchPlan(id)), 'trip');
      return patch<Trip>(id, 'trip', body);
    },
    invite: (id, personIds) => invite<Trip>(id, 'trip', personIds),
    respond: (id, answer) => respond<Trip>(id, 'trip', answer === 'join' ? 'accept' : 'decline'),
    removeTraveler: (id, personId) => removePerson<Trip>(id, 'trip', personId),
    async makeOrganizer(id, personId) {
      return ofType<Trip>(keep((await api.call('POST', `/plans/${id}/owner`, PlanSchema, { personId }, await versioned(id))) as Plan), 'trip');
    },
    remove: removePlan,
    setPreferences: refuse('Trip preferences'),
    pick: refuse('Choosing places'),
    finishChoosing: refuse('Choosing places'),
    setMustDo: refuse('Must-dos'),
    generateItinerary: refuse('The itinerary'),
    toggleLock: refuse('The itinerary'),
    replaceItem: refuse('The itinerary'),
    moveItem: refuse('The itinerary'),
    setDuration: refuse('The itinerary'),
    removeItem: refuse('The itinerary'),
    suggestReplacement: refuse('Suggesting a replacement'),
    keepOriginal: refuse('The itinerary'),
  };

  return {
    plans,
    invitations,
    hangouts,
    events,
    trips,
    people: async () => (await api.call('GET', '/people', PeopleListSchema)).items,
    async mutedPlans() {
      return (await api.call('GET', '/me/muted-plans', MutedPlansSchema)).planIds;
    },
    async setMutedPlans(ids) {
      const before = new Set((await api.call('GET', '/me/muted-plans', MutedPlansSchema)).planIds);
      const after = new Set(ids);
      const changes = [...new Set([...before, ...after])].filter((id) => before.has(id) !== after.has(id));
      for (const id of changes) await api.call('PUT', `/plans/${id}/mute`, null, { muted: after.has(id) });
      return (await api.call('GET', '/me/muted-plans', MutedPlansSchema)).planIds;
    },
    reset: () => seen.clear(),
  };
}
