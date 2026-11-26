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
  type AccountSettings,
  type Capability,
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
import {
  canSee, classifyPlan, guestView, relationTo, sortPast, sortUpcoming,
} from '@/services/planRules';
import {
  HANGOUT_TEMPLATES, VOYA_SUGGESTION, canFinalize, slotForCategory, slotMinutes, slotSummary, slotsFor,
} from '@/services/hangoutRules';
import { removeAvatar, saveAvatar } from './avatarStore';
import { devAccountFor } from './devAccounts';
import * as fx from './fixtures';
import { sha256Hex } from './sha256';
import {
  currentAccountId,
  mutate,
  createLocalAccount,
  deletedPeople,
  markPersonDeleted,
  readWorld,
  writeWorld,
  hasAccountState,
  deleteLocalAccount,
  peek,
  read,
  readAccountRegistry,
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

/**
 * Finds a plan the person may act on. A plan the person cannot see is reported
 * as not found, exactly like a missing one, so records never leak.
 * `allowGuest` lets event guests through (for their own RSVP only).
 */
function requirePlan<T extends Plan>(
  plans: Plan[], id: ID, type: T['type'], personId: ID, allowGuest = false,
): T {
  const plan = plans.find((p) => p.id === id);
  const relation = plan ? relationTo(plan, personId) : 'none';
  // Only members act on a plan; event guests only where allowed; invitees only answer (respond).
  if (!plan || !(relation === 'member' || (relation === 'guest' && allowGuest))) {
    throw new ServiceError('not_found', 'Plan not found.', false);
  }
  if (plan.type !== type) throw new ServiceError('wrong_type', 'Unexpected plan type.', false);
  return plan as T;
}

/**
 * Add to Plan eligibility (UI simulation rule). The board offers hangouts and
 * trips: a hangout member who may suggest and that is not finalized yet, or any
 * traveler on a trip. Events take no place suggestions.
 */
function canAddPlace(plan: Plan, personId: ID): boolean {
  if (plan.type === 'hangout') return !plan.finalized && can(plan, personId, 'suggestion.create');
  if (plan.type === 'trip') return true;
  return false;
}

function hasPlace(plan: Plan, placeId: ID): boolean {
  if (plan.type === 'hangout') return plan.suggestions.some((s) => s.placeId === placeId);
  if (plan.type === 'trip') return plan.mustDoPlaceIds.includes(placeId);
  return false;
}

/** What a person sees of a plan: members get it whole, event guests the guest view. */
function visibleCopy(plan: Plan, personId: ID): Plan {
  return plan.type === 'event' && relationTo(plan, personId) === 'guest' ? guestView(plan) : plan;
}

function visiblePlans(plans: Plan[], personId: ID): Plan[] {
  return plans.filter((p) => canSee(p, personId)).map((p) => visibleCopy(p, personId));
}

/** The person id used for plan membership (the dev account plans as the seeded Ahmad). */
function me(state: { account: { id: ID; personId?: ID } }): ID {
  return state.account.personId ?? state.account.id;
}

function can(plan: Plan, personId: ID, capability: string): boolean {
  const member = plan.members.find((m) => m.personId === personId);
  return !!member?.capabilities.includes(capability as never);
}

// ---------------------------------------------------------------- auth

/** Seeded identities sign in as `<firstname>@example.com`. */
function seededPersonFor(email: string) {
  return fx.people.find((p) => `${p.firstName.toLowerCase()}@example.com` === email.toLowerCase());
}

const auth: AuthService = {
  async getSession() {
    const id = await currentAccountId();
    if (!id) return null;
    const snapshot = await peek();
    return { accountId: id, email: snapshot?.state.account.email ?? '' };
  },
  async signIn(email, password) {
    // Development test account: checked against a stored SHA-256 digest only.
    const dev = devAccountFor(email);
    if (dev) {
      if (sha256Hex(password) !== dev.passwordSha256) {
        throw new ServiceError('bad_credentials', 'That email and password do not match.', false);
      }
      if (!(await hasAccountState(dev.account.id))) await createLocalAccount(structuredClone(dev.account));
      await setCurrentAccountId(dev.account.id);
      return { accountId: dev.account.id, email: dev.email };
    }
    // Other mock accounts: the mock checks the account exists; it never stores or checks passwords.
    const found = seededPersonFor(email);
    const seeded = found && !(await deletedPeople()).includes(found.id) ? found : undefined;
    const local = (await readAccountRegistry())[email.toLowerCase()];
    const accountId = seeded?.id ?? local;
    if (!accountId) {
      throw new ServiceError('no_account', 'No account uses that email. Create one instead.', false);
    }
    await setCurrentAccountId(accountId);
    return { accountId, email } satisfies AuthSession;
  },
  async signUp(email, _password, names) {
    const normalized = email.trim().toLowerCase();
    if (seededPersonFor(normalized) || devAccountFor(normalized) || (await readAccountRegistry())[normalized]) {
      throw new ServiceError('email_taken', 'An account already uses that email.', false);
    }
    const firstName = names.firstName.trim();
    const lastName = names.lastName.trim();
    const id = uid('acct');
    await createLocalAccount({
      id,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      email: normalized,
      emailVerified: false,
      onboardingStep: 'profile',
      onboardingComplete: false,
      interests: [],
    });
    await setCurrentAccountId(id);
    return { accountId: id, email: normalized };
  },
  async verifyEmailCode(code) {
    if (code !== DEV_VERIFICATION_CODE) {
      throw new ServiceError('bad_code', 'That code is not correct.', true);
    }
    await mutate((s) => {
      s.account.emailVerified = true;
    });
  },
  async resendVerificationCode() {
    // Nothing is sent. In development the code is always 424242.
  },
  async abandonSignUp() {
    const snapshot = await peek();
    if (snapshot && snapshot.state.account.emailVerified === false) {
      await deleteLocalAccount(snapshot.accountId);
    }
    await setCurrentAccountId(null);
  },
  async requestPasswordReset() {
    // The frozen design sends a reset LINK here (A04 → A05). Nothing is emailed.
  },
  async setNewPassword(password) {
    // No credential is ever stored by the mock; only the board's rule is enforced.
    if (password.length < 8) {
      throw new ServiceError('weak_password', 'Use at least 8 characters.', false);
    }
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
  async deleteAccount() {
    const { accountId, state } = await read();
    const personId = me(state);
    if (personId === accountId) {
      const world = await readWorld();
      await writeWorld({ plans: removePersonFromPlans(world.plans, personId) });
    }
    removeAvatar(state.account.avatarRef);
    if (fx.people.some((p) => p.id === accountId)) await markPersonDeleted(accountId);
    // Local and dev accounts: drop the data (a dev account is recreated fresh on its next sign-in).
    await deleteLocalAccount(accountId);
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
  async setAvatar(localUri) {
    const { accountId, state } = await read();
    const previous = state.account.avatarRef;
    const ref = localUri ? saveAvatar(localUri, accountId) : undefined;
    const account = await mutate((s) => {
      if (ref) s.account.avatarRef = ref;
      else delete s.account.avatarRef;
      return s.account;
    });
    if (previous && previous !== ref) removeAvatar(previous);
    return account;
  },
  async getSettings() {
    const { state } = await read();
    return settingsOf(state);
  },
  updateSettings: (patch) =>
    mutate((s) => {
      const current = settingsOf(s);
      s.settings = {
        ...current,
        ...patch,
        notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
      };
      return s.settings;
    }),
  resetRecommendations: () =>
    mutate((s) => {
      s.signals = {};
    }),
};

function settingsOf(state: { settings?: AccountSettings }): AccountSettings {
  return structuredClone(state.settings ?? fx.DEFAULT_SETTINGS);
}

/**
 * Mock account-deletion policy for the SHARED plan world (deterministic, local only):
 * - the person's memberships and event guest entries are removed;
 * - their votes are removed; suggestions they made stay (they are group
 *   content) but are no longer attributed to them;
 * - a plan they own passes to the next remaining member, who inherits the
 *   owner's capabilities and role; a plan with nobody left is removed.
 * Skipped when the identity is shared with another account (the dev account
 * plans as the seeded Ahmad), so deleting it never strips Ahmad's plans.
 */
export function removePersonFromPlans(plans: Plan[], personId: ID): Plan[] {
  const out: Plan[] = [];
  for (const original of plans) {
    const plan = structuredClone(original) as Plan;
    const leaving = plan.members.find((m) => m.personId === personId);
    const touched = !!leaving || (plan.type === 'event' && plan.guests.some((g) => g.personId === personId))
      || (plan.type === 'hangout' && (plan.suggestions.some((sg) => sg.suggestedBy === personId || personId in sg.votes)
        || (plan.invites ?? []).some((i) => i.personId === personId)));
    if (!touched) {
      out.push(plan);
      continue;
    }
    plan.members = plan.members.filter((m) => m.personId !== personId);
    if (plan.type === 'event') plan.guests = plan.guests.filter((g) => g.personId !== personId);
    if (plan.type === 'hangout') {
      plan.invites = (plan.invites ?? []).filter((i) => i.personId !== personId);
      for (const sg of plan.suggestions) {
        delete sg.votes[personId];
        if (sg.suggestedBy === personId) sg.suggestedBy = 'former-member';
      }
    }
    if (plan.ownerId === personId) {
      const heir = plan.members[0];
      if (!heir) continue; // nobody left: the plan goes too
      plan.ownerId = heir.personId;
      if (leaving) {
        heir.role = leaving.role;
        heir.capabilities = Array.from(new Set([...heir.capabilities, ...leaving.capabilities]));
      }
    }
    if (plan.members.length === 0 && !(plan.type === 'event' && plan.guests.length > 0)) continue;
    plan.version += 1;
    out.push(plan);
  }
  return out;
}

// -------------------------------------------------------------- places

const KM_PER_DEG = 111.32;

/** Mock distance from the city's centre (equirectangular; fine at city scale). */
function distanceFromCentre(place: Place): number | undefined {
  const centre = fx.CITY_CENTERS[place.city];
  if (!centre || !place.coordinates) return undefined;
  const dLat = (place.coordinates.latitude - centre.latitude) * KM_PER_DEG;
  const dLon = (place.coordinates.longitude - centre.longitude) * KM_PER_DEG
    * Math.cos((centre.latitude * Math.PI) / 180);
  return Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 10) / 10;
}

/** Every word must appear somewhere in the place's name, type, category, area or tags. */
function matchesQuery(place: Place, query: string): boolean {
  const haystack = [place.name, place.type, place.category, place.area, ...(place.tags ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => haystack.includes(w));
}

function rank(places: Place[], q: PlacesQuery): Place[] {
  const categories = q.categories?.length
    ? q.categories
    : q.category && q.category !== 'All' ? [q.category] : [];
  return places
    .filter((p) => !p.permanentlyClosed)
    .filter((p) => (q.city ? p.city === q.city : true))
    .filter((p) => (categories.length ? categories.includes(p.category) : true))
    .filter((p) => (q.prices?.length ? !!p.price && q.prices.includes(p.price) : true))
    .filter((p) => (q.minRating !== undefined ? (p.rating ?? 0) >= q.minRating : true))
    // Unknown hours are not "open now"; they are excluded only when the filter is on.
    .filter((p) => (q.openNow ? p.openNow === true : true))
    .filter((p) => (q.tags?.length ? q.tags.every((t) => p.tags?.includes(t)) : true))
    .filter((p) => {
      if (q.maxDistanceKm === undefined) return true;
      const d = distanceFromCentre(p);
      return d !== undefined && d <= q.maxDistanceKm;
    })
    .filter((p) => (q.query?.trim() ? matchesQuery(p, q.query) : true))
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
  async search(q) {
    await read();
    if (!q.query?.trim()) return [];
    return rank(fx.places, q);
  },
  distanceKm: (place) => distanceFromCentre(place),
  async recentSearches() {
    const { state } = await read();
    return state.recentSearches ?? [];
  },
  async exploreCity() {
    const { state } = await read();
    return state.exploreCity;
  },
  chooseCity: (city) =>
    mutate((s) => {
      if (city === null) {
        delete s.exploreCity;
        return;
      }
      if (!fx.DESTINATIONS.some((d) => d.city === city)) {
        throw new ServiceError('not_found', 'Unknown city.', false);
      }
      s.exploreCity = city;
      s.recentCities = [city, ...(s.recentCities ?? []).filter((c) => c !== city)].slice(0, 3);
    }),
  async recentCities() {
    const { state } = await read();
    return state.recentCities ?? [];
  },
  rememberSearch: (query) =>
    mutate((s) => {
      const q = query.trim();
      if (!q) return;
      const rest = (s.recentSearches ?? []).filter((x) => x.toLowerCase() !== q.toLowerCase());
      s.recentSearches = [q, ...rest].slice(0, 5);
    }),
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
    return visiblePlans(state.plans, me(state))
      .filter((p) => classifyPlan(p, now) === 'upcoming')
      .sort(sortUpcoming);
  },
  async listPast() {
    const { state } = await read();
    const now = Date.now();
    return visiblePlans(state.plans, me(state))
      .filter((p) => classifyPlan(p, now) === 'past')
      .sort(sortPast);
  },
  async get(id) {
    const { state } = await read();
    const plan = state.plans.find((p) => p.id === id);
    if (!plan || !canSee(plan, me(state))) {
      throw new ServiceError('not_found', 'Plan not found.', false);
    }
    return visibleCopy(plan, me(state));
  },
  createTrip: (input) =>
    mutate((s) => {
      const trip: Trip = {
        id: uid('plan'), type: 'trip', title: input.title, destination: input.destination,
        city: input.destination, lifecycle: 'active', ownerId: me(s), version: 1,
        startsAt: input.startsAt, endsAt: input.endsAt, generated: false,
        mustDoPlaceIds: [], days: [],
        members: [{
          personId: me(s), role: 'organizer',
          capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create'],
          joinedAt: new Date().toISOString(),
        }],
      };
      s.plans.push(trip);
      return trip;
    }),
  createHangout: (input) =>
    mutate((s) => {
      const title = input.title.trim();
      if (!title) throw new ServiceError('invalid', 'Give your hangout a name.', false);
      if (!input.startsAt || Number.isNaN(Date.parse(input.startsAt))) {
        throw new ServiceError('invalid', 'Choose when it happens.', false);
      }
      if (!HANGOUT_TEMPLATES[input.template]) throw new ServiceError('invalid', 'Choose what kind of hangout.', false);
      const now = new Date().toISOString();
      const invitees = [...new Set(input.invitees ?? [])].filter((p) => p !== me(s) && fx.people.some((x) => x.id === p));
      const hangout: Hangout = {
        id: uid('plan'), type: 'hangout', title, city: input.city,
        lifecycle: 'active', ownerId: me(s), version: 1, startsAt: input.startsAt,
        template: input.template, finalized: false, suggestions: [], timeline: [], changeRequests: [],
        invites: invitees.map((personId) => ({ personId, status: 'pending' as const, invitedBy: me(s), invitedAt: now })),
        members: [{
          personId: me(s), role: 'organizer',
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
        lifecycle: 'active', ownerId: me(s), version: 1, startsAt: input.startsAt,
        venue: input.venue, guests: [], schedule: [],
        members: [{
          personId: me(s), role: 'host',
          capabilities: ['plan.edit', 'member.manage', 'invite.create', 'schedule.edit'],
          joinedAt: new Date().toISOString(),
        }],
      };
      s.plans.push(event);
      return event;
    }),
  async addTargets(placeId) {
    const { state } = await read();
    const now = Date.now();
    return state.plans
      .filter((p) => relationTo(p, me(state)) === 'member' && classifyPlan(p, now) === 'upcoming')
      .filter((p) => canAddPlace(p, me(state)))
      .sort(sortUpcoming)
      .map((plan) => ({ plan, alreadyAdded: hasPlace(plan, placeId) }));
  },
  addPlace: (planId, placeId) =>
    mutate((s) => {
      const plan = s.plans.find((p) => p.id === planId);
      if (!plan || relationTo(plan, me(s)) !== 'member' || !canAddPlace(plan, me(s))) {
        throw new ServiceError('not_found', 'Plan not found.', false);
      }
      if (!fx.places.some((p) => p.id === placeId)) throw new ServiceError('not_found', 'Place not found.', false);
      if (hasPlace(plan, placeId)) return { added: false };
      if (plan.type === 'hangout') {
        const category = fx.places.find((p) => p.id === placeId)!.category;
        plan.suggestions.push({ id: uid('sg'), placeId, slot: slotForCategory(plan.template, category), suggestedBy: me(s), votes: {} });
      } else if (plan.type === 'trip') {
        plan.mustDoPlaceIds.push(placeId);
      }
      plan.version += 1;
      return { added: true };
    }),
  /** Leaving removes this person's membership or guest entry; the plan stays for everyone else. */
  leave: (id) =>
    mutate((s) => {
      const plan = s.plans.find((p) => p.id === id);
      if (!plan || !canSee(plan, me(s))) throw new ServiceError('not_found', 'Plan not found.', false);
      plan.members = plan.members.filter((m) => m.personId !== me(s));
      if (plan.type === 'event') plan.guests = plan.guests.filter((g) => g.personId !== me(s));
      plan.version += 1;
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

      const joined = s.plans.find((p) => p.id === invite.planId);
      if (!joined) throw new ServiceError('not_found', 'That plan no longer exists.', false);
      if (canSee(joined, me(s))) return { planId: joined.id, alreadyMember: true };

      if (joined.type === 'event') {
        // Event invitations make you a guest, not a host.
        joined.guests.push({
          id: uid('g'), personId: me(s), displayName: s.account.displayName, rsvp: 'pending',
        });
      } else {
        joined.members.push({
          personId: me(s), role: invite.role,
          capabilities: ['suggestion.create', 'vote.cast'],
          joinedAt: new Date().toISOString(),
        });
      }
      joined.version += 1;
      return { planId: joined.id, alreadyMember: false };
    }),
  async createForPlan(planId) {
    const { state } = await read();
    const plan = state.plans.find((p) => p.id === planId);
    if (!plan || relationTo(plan, me(state)) !== 'member') {
      throw new ServiceError('not_found', 'Plan not found.', false);
    }
    return {
      token: uid('inv'), planId, planType: plan.type, planTitle: plan.title,
      inviterName: state.account.displayName,
      role: plan.type === 'event' ? 'guest' : 'participant',
    };
  },
};

// ------------------------------------------------------------ hangouts

/** Hangout mutations open only to the organizer (member.manage / plan.edit). */
function requireOrganizer(h: Hangout, personId: ID, action: string) {
  if (!can(h, personId, 'plan.edit') && !can(h, personId, 'member.manage')) {
    throw new ServiceError('forbidden', `Only the organizer can ${action}.`, false);
  }
}

function requireOpen(h: Hangout) {
  if (h.finalized) throw new ServiceError('finalized', 'This hangout is already finalized.', false);
}

const PARTICIPANT_CAPS: Capability[] = ['suggestion.create', 'vote.cast'];

const hangouts: HangoutsService = {
  update: (id, patch) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      requireOrganizer(h, me(s), 'edit this hangout');
      if (patch.title !== undefined) {
        if (!patch.title.trim()) throw new ServiceError('invalid', 'Give your hangout a name.', false);
        h.title = patch.title.trim();
      }
      if (patch.city !== undefined) h.city = patch.city;
      if (patch.startsAt !== undefined) {
        if (Number.isNaN(Date.parse(patch.startsAt))) throw new ServiceError('invalid', 'That date is not valid.', false);
        h.startsAt = patch.startsAt;
      }
      if (patch.template !== undefined && patch.template !== h.template) {
        if (!HANGOUT_TEMPLATES[patch.template]) throw new ServiceError('invalid', 'Choose a template.', false);
        requireOpen(h);
        const slots = slotsFor(patch.template);
        h.template = patch.template;
        h.suggestions = h.suggestions.filter((sg) => slots.includes(sg.slot));
      }
      h.version += 1;
      return h;
    }),
  invite: (id, personIds) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      if (!can(h, me(s), 'invite.create')) throw new ServiceError('forbidden', 'Only the organizer can invite.', false);
      h.invites ??= [];
      const now = new Date().toISOString();
      for (const personId of new Set(personIds)) {
        if (personId === h.ownerId || !fx.people.some((p) => p.id === personId)) continue;
        const existing = h.invites.find((i) => i.personId === personId);
        if (existing && existing.status !== 'declined') continue; // already invited or joined
        if (existing) existing.status = 'pending';
        else h.invites.push({ personId, status: 'pending', invitedBy: me(s), invitedAt: now });
      }
      h.version += 1;
      return h;
    }),
  respond: (id, response) =>
    mutate((s) => {
      const h = s.plans.find((p) => p.id === id);
      const invite = h?.type === 'hangout' ? (h.invites ?? []).find((i) => i.personId === me(s)) : undefined;
      if (!h || h.type !== 'hangout' || !invite) throw new ServiceError('not_found', 'This invitation is not available.', false);
      if (h.ownerId === me(s)) throw new ServiceError('invalid', 'The organizer is always in.', false);
      invite.status = response;
      const isMember = h.members.some((m) => m.personId === me(s));
      if (response === 'declined') {
        h.members = h.members.filter((m) => m.personId !== me(s));
        for (const sg of h.suggestions) delete sg.votes[me(s)];
      } else if (!isMember) {
        h.members.push({ personId: me(s), role: 'participant', capabilities: [...PARTICIPANT_CAPS], joinedAt: new Date().toISOString() });
      }
      h.version += 1;
      return h;
    }),
  removePerson: (id, personId) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      if (!can(h, me(s), 'member.manage')) throw new ServiceError('forbidden', 'Only the organizer can remove people.', false);
      if (personId === h.ownerId) throw new ServiceError('invalid', 'The organizer cannot be removed.', false);
      h.members = h.members.filter((m) => m.personId !== personId);
      h.invites = (h.invites ?? []).filter((i) => i.personId !== personId);
      for (const sg of h.suggestions) delete sg.votes[personId];
      h.version += 1;
      return h;
    }),
  remove: async (id) => {
    await mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      if (h.ownerId !== me(s)) throw new ServiceError('forbidden', 'Only the organizer can delete this hangout.', false);
      s.plans = s.plans.filter((p) => p.id !== id);
    });
  },
  suggestPlace: (id, placeId, slot) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      requireOpen(h);
      if (!can(h, me(s), 'suggestion.create')) throw new ServiceError('forbidden', 'You cannot suggest places here.', false);
      if (!slotsFor(h.template).includes(slot)) throw new ServiceError('invalid', 'That part of the plan does not exist.', false);
      if (!fx.places.some((p) => p.id === placeId)) throw new ServiceError('not_found', 'Place not found.', false);
      if (h.suggestions.some((x) => x.placeId === placeId && x.slot === slot)) {
        throw new ServiceError('duplicate', 'That place is already suggested for this slot.', false);
      }
      h.suggestions.push({ id: uid('sg'), placeId, slot, suggestedBy: me(s), votes: {} });
      h.version += 1;
      return h;
    }),
  vote: (id, suggestionId, value) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      requireOpen(h);
      if (!can(h, me(s), 'vote.cast')) throw new ServiceError('forbidden', 'You cannot vote on this hangout.', false);
      const sg = h.suggestions.find((x) => x.id === suggestionId);
      if (!sg) throw new ServiceError('not_found', 'Suggestion not found.', false);
      if (value) sg.votes[me(s)] = value; // one vote per person per suggestion
      else delete sg.votes[me(s)];
      h.version += 1;
      return h;
    }),
  voteForPlace: (id, slot, placeId) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      requireOpen(h);
      if (!can(h, me(s), 'vote.cast')) throw new ServiceError('forbidden', 'You cannot vote on this hangout.', false);
      if (!slotsFor(h.template).includes(slot)) throw new ServiceError('invalid', 'That part of the plan does not exist.', false);
      if (!fx.places.some((p) => p.id === placeId)) throw new ServiceError('not_found', 'Place not found.', false);
      let sg = h.suggestions.find((x) => x.placeId === placeId && x.slot === slot);
      if (!sg) {
        sg = { id: uid('sg'), placeId, slot, suggestedBy: VOYA_SUGGESTION, votes: {} };
        h.suggestions.push(sg);
      }
      sg.votes[me(s)] = 'up';
      h.version += 1;
      return h;
    }),
  simulateParticipantVotes: (id) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      requireOpen(h);
      const others = h.members.map((m) => m.personId).filter((p) => p !== me(s));
      // Deterministic: each other member backs the current leader of every slot.
      for (const slot of slotsFor(h.template)) {
        const leader = slotSummary(h, slot).leader;
        if (leader) for (const p of others) leader.votes[p] = 'up';
      }
      h.version += 1;
      return h;
    }),
  finalize: (id) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      if (!can(h, me(s), 'timeline.finalize')) throw new ServiceError('forbidden', 'Only the organizer can finalize.', false);
      requireOpen(h);
      if (!canFinalize(h)) throw new ServiceError('incomplete', 'Every part of the plan needs a place with a vote first.', false);
      let at = Date.parse(h.startsAt ?? new Date().toISOString());
      h.timeline = slotsFor(h.template).map((slot) => {
        const winner = slotSummary(h, slot).leader!;
        const place = fx.places.find((p) => p.id === winner.placeId);
        const item: TimelineItem = {
          id: uid('tl'), startsAt: new Date(at).toISOString(), title: slot, subtitle: place?.name, placeId: winner.placeId,
        };
        at += slotMinutes(slot) * 60 * 1000;
        return item;
      });
      h.finalized = true;
      h.version += 1;
      return h;
    }),
  proposeChange: (id, change) =>
    mutate((s) => {
      const h = requirePlan<Hangout>(s.plans, id, 'hangout', me(s));
      if (!h.finalized) throw new ServiceError('invalid', 'Changes can be suggested once the plan is final.', false);
      if (!slotsFor(h.template).includes(change.slot)) throw new ServiceError('invalid', 'Choose what to change.', false);
      const note = change.note?.trim();
      if (!change.placeId && !note) throw new ServiceError('invalid', 'Suggest a place or add a note.', false);
      if (change.placeId && !fx.places.some((p) => p.id === change.placeId)) throw new ServiceError('not_found', 'Place not found.', false);
      h.changeRequests ??= [];
      h.changeRequests.push({ id: uid('cr'), slot: change.slot, placeId: change.placeId, note: note || undefined, by: me(s), at: new Date().toISOString() });
      h.version += 1;
      return h;
    }),
};

// -------------------------------------------------------------- events

const events: EventsService = {
  setRsvp: (eventId, guestId, rsvp: RSVP) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event', me(s), true);
      const guest = e.guests.find((g) => g.id === guestId);
      if (!guest) throw new ServiceError('not_found', 'Guest not found.', false);
      if (relationTo(e, me(s)) === 'guest' && guest.personId !== me(s)) {
        throw new ServiceError('forbidden', 'Guests can only answer for themselves.', false);
      }
      guest.rsvp = rsvp; // one RSVP row per guest
      e.version += 1;
      return e;
    }),
  addGuest: (eventId, displayName) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event', me(s));
      if (!can(e, me(s), 'member.manage')) {
        throw new ServiceError('forbidden', 'Only hosts can manage guests.', false);
      }
      e.guests.push({ id: uid('g'), displayName, rsvp: 'pending' });
      e.version += 1;
      return e;
    }),
  upsertScheduleItem: (eventId, item) =>
    mutate((s) => {
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event', me(s));
      if (!can(e, me(s), 'schedule.edit')) {
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
      const e = requirePlan<VoyaEvent>(s.plans, eventId, 'event', me(s));
      if (!can(e, me(s), 'schedule.edit')) {
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
    const e = requirePlan<VoyaEvent>(state.plans, eventId, 'event', me(state), true);
    return guestView(structuredClone(e) as VoyaEvent);
  },
};

// --------------------------------------------------------------- trips

const trips: TripsService = {
  setMustDo: (tripId, placeId, on) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip', me(s));
      t.mustDoPlaceIds = on
        ? [...new Set([...t.mustDoPlaceIds, placeId])]
        : t.mustDoPlaceIds.filter((x) => x !== placeId);
      t.version += 1;
      return t;
    }),
  /** Fixture-backed. NOT the production scheduler. */
  generateItinerary: (tripId) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip', me(s));
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
      const t = requirePlan<Trip>(s.plans, tripId, 'trip', me(s));
      for (const day of t.days) {
        const item = day.items.find((i) => i.id === itemId);
        if (item) item.locked = !item.locked;
      }
      t.version += 1;
      return t;
    }),
  replaceItem: (tripId, itemId, placeId) =>
    mutate((s) => {
      const t = requirePlan<Trip>(s.plans, tripId, 'trip', me(s));
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
  async categories() {
    return [...fx.CATEGORIES];
  },
  async interests() {
    return [...fx.TASTE_INTERESTS];
  },
  async popularSearches() {
    return [...fx.POPULAR_SEARCHES];
  },
  async destinations() {
    return structuredClone(fx.DESTINATIONS);
  },
  async cityCenter(city) {
    return fx.CITY_CENTERS[city] ?? null;
  },
  async dreamDestinations() {
    return fx.DESTINATIONS.filter((d) => fx.DREAM_DESTINATIONS.includes(d.city));
  },
  async people() {
    return structuredClone(fx.people);
  },
};

export const mockServices: Services = {
  auth, profile, places, saved, plans, invitations, hangouts, events, trips, notifications, catalog,
};

export const devTools = { resetAll, setCurrentAccountId };
