import type {
  Account,
  AccountSettings,
  ActivityEntry,
  Hangout,
  ID,
  Invitation,
  OnboardingStep,
  Person,
  Place,
  PlaceCategory,
  PlaceSignal,
  Plan,
  PlanType,
  RSVP,
  TripPick,
  TripPreferences,
  CohostPermissions,
  EventScheduleItem,
  SavedPlace,
  Trip,
  VoyaEvent,
} from './types';

/**
 * Service contracts.
 *
 * Today these are satisfied by src/mocks/*. Later the same interfaces are
 * satisfied by the generated NestJS API client. Screens depend ONLY on these —
 * never on fixtures, storage or a provider SDK. Replacing the implementation
 * must not require rewriting a screen.
 */

export interface AuthSession {
  accountId: ID;
  email: string;
}

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  /**
   * Creates a separate local account. The mock never stores the password; it
   * only checks the email is free. The new account starts unverified.
   */
  signUp(email: string, password: string, profile: { firstName: string; lastName: string }): Promise<AuthSession>;
  /** The frozen design verifies with a code (A06) and resets with a link (A04/A05). */
  verifyEmailCode(code: string): Promise<void>;
  /** Mock: "sends" a new code; nothing leaves the device. */
  resendVerificationCode(): Promise<void>;
  /** Change email (A06): drops the unverified account so sign-up can start over. */
  abandonSignUp(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  setNewPassword(password: string): Promise<void>;
  signInWithApple(): Promise<AuthSession>;
  signInWithGoogle(): Promise<AuthSession>;
  signOut(): Promise<void>;
  /**
   * Called when the session ends outside the app's own sign-out (revoked,
   * refresh failed, the API answered 401). Real provider only.
   */
  onSessionEnded?(listener: () => void): () => void;
  /** The fixed development code the mock accepts; undefined when real codes are emailed. */
  verificationCodeHint?: string;
  /**
   * V10 account deletion. Mock: removes this account's local data and signs
   * out. Shared plans stay consistent for everyone else (see the mock policy).
   */
  deleteAccount(): Promise<void>;
}

export interface ProfileService {
  getAccount(): Promise<Account>;
  updateProfile(patch: Partial<Pick<Account, 'firstName' | 'lastName' | 'displayName' | 'city' | 'bio'>>): Promise<Account>;
  setInterests(interests: string[]): Promise<Account>;
  completeOnboardingStep(step: OnboardingStep): Promise<Account>;
  /**
   * Stores a picked photo as the profile photo. The mock copies it into app
   * storage (later: upload to storage); `null` removes the photo.
   */
  setAvatar(localUri: string | null): Promise<Account>;
  getSettings(): Promise<AccountSettings>;
  updateSettings(patch: Partial<Omit<AccountSettings, 'notifications'>> & {
    notifications?: Partial<AccountSettings['notifications']>;
  }): Promise<AccountSettings>;
  /** V06 "Reset recommendation preferences": forgets likes and skips. */
  resetRecommendations(): Promise<void>;
}

export interface PlacesQuery {
  city?: string;
  /** Explore's single category chip. Ignored when `categories` is set. */
  category?: PlaceCategory | 'All';
  /** Filters sheet (E07): any of these categories. */
  categories?: PlaceCategory[];
  /** Words to match against name, type, category, area and tags. */
  query?: string;
  /** Any of these price levels ('$'…'$$$$'). */
  prices?: string[];
  /** Within this many km of where the user is (mock: the city centre). */
  maxDistanceKm?: number;
  minRating?: number;
  openNow?: boolean;
  /** All of these tags ("A little more you"). */
  tags?: string[];
}

export interface PlacesService {
  discover(q: PlacesQuery): Promise<Place[]>;
  /** Search (E10/E11): the same filters as discover, but every match, swiped or not. */
  search(q: PlacesQuery): Promise<Place[]>;
  /** Distance in km from where the user is (mock: city centre); undefined when unknown. */
  distanceKm(place: Place): number | undefined;
  recentSearches(): Promise<string[]>;
  rememberSearch(query: string): Promise<void>;
  /** Explore's chosen city for this account; undefined means near me. */
  exploreCity(): Promise<string | undefined>;
  /** Sets Explore's city (null = back to near me) and records it as recent. */
  chooseCity(city: string | null): Promise<void>;
  recentCities(): Promise<string[]>;
  getPlace(id: ID): Promise<Place>;
  setSignal(placeId: ID, signal: PlaceSignal): Promise<void>;
}

export interface SavedService {
  list(): Promise<SavedPlace[]>;
  isSaved(placeId: ID): Promise<boolean>;
  save(placeId: ID): Promise<void>;
  unsave(placeId: ID): Promise<void>;
}

export interface PlansService {
  listUpcoming(): Promise<Plan[]>;
  listPast(): Promise<Plan[]>;
  get(id: ID): Promise<Plan>;
  /** 13: the creator becomes organizer; invitees get pending invitations. */
  createHangout(input: { title: string; city: string; template: string; startsAt: string; invitees?: ID[] }): Promise<Hangout>;
  /** 18: the creator becomes host; `hosts` become hosts too. Cover is a local image URI to copy. */
  createEvent(input: EventInput & { hosts?: ID[] }): Promise<VoyaEvent>;
  leave(id: ID): Promise<void>;
  /**
   * Add to Plan (E09): upcoming hangouts and trips the user can suggest places
   * to. `alreadyAdded` marks plans that already have this place.
   */
  addTargets(placeId: ID): Promise<{ plan: Plan; alreadyAdded: boolean }[]>;
  /** Adds the place as a suggestion (hangout) or Must Do (trip). Repeats are no-ops. */
  addPlace(planId: ID, placeId: ID): Promise<{ added: boolean }>;
}

export interface InvitationsService {
  resolve(token: string): Promise<Invitation>;
  /**
   * Opening an invitation (development deep link today, real links later):
   * puts the signed-in person on the plan's invite list, so the plan's own
   * invitation screen (12, 17, 20) shows next. Joining happens there.
   */
  accept(token: string): Promise<{ planId: ID; planType: PlanType; alreadyMember: boolean }>;
  createForPlan(planId: ID): Promise<Invitation>;
}

export interface HangoutsService {
  /** Organizer edits (H02). Template changes keep suggestions whose slot still exists. */
  update(hangoutId: ID, patch: { title?: string; city?: string; startsAt?: string; template?: string }): Promise<Hangout>;
  /** Organizer invites friends (13, H03). Already-invited people are skipped. */
  invite(hangoutId: ID, personIds: ID[]): Promise<Hangout>;
  /** The signed-in person answers their invitation (17) or changes it (H03). */
  respond(hangoutId: ID, response: 'in' | 'maybe' | 'declined'): Promise<Hangout>;
  /** Organizer removes someone (H03); their votes go, their suggestions stay. */
  removePerson(hangoutId: ID, personId: ID): Promise<Hangout>;
  /** Organizer deletes the hangout for everyone (H01). */
  remove(hangoutId: ID): Promise<void>;
  suggestPlace(hangoutId: ID, placeId: ID, slot: string): Promise<Hangout>;
  /** Up-vote (or clear your vote on) a suggestion (15). One vote per person per suggestion. */
  vote(hangoutId: ID, suggestionId: ID, value: 'up' | null): Promise<Hangout>;
  /** "Yes" in Choose together (14): votes for the place, adding it as a Voya suggestion if new. */
  voteForPlace(hangoutId: ID, slot: string, placeId: ID): Promise<Hangout>;
  /** Development affordance: lets one device demonstrate group convergence. */
  simulateParticipantVotes(hangoutId: ID): Promise<Hangout>;
  /** Organizer only. Builds the timeline from each slot's leading place (16). */
  finalize(hangoutId: ID): Promise<Hangout>;
  /** H07: records a proposed change; the finalized timeline is not altered. */
  proposeChange(hangoutId: ID, change: { slot: string; placeId?: ID; note?: string }): Promise<Hangout>;
}

export interface EventInput {
  title: string;
  /** "Location" on the board: the venue. */
  venue: string;
  city?: string;
  startsAt: string;
  endsAt?: string;
  description?: string;
  /** A picked image (file:// URI) to copy into app storage. */
  coverUri?: string;
}

export interface EventsService {
  /** EV02. Needs plan.edit. `coverUri: null` removes a picked cover. */
  update(eventId: ID, patch: Partial<Omit<EventInput, 'coverUri'>> & { coverUri?: string | null }): Promise<VoyaEvent>;
  /** The signed-in guest answers their own invitation (20, 21). */
  respond(eventId: ID, rsvp: Exclude<RSVP, 'pending'>): Promise<VoyaEvent>;
  /** Host override for a guest's answer (40), e.g. someone who answered by phone. */
  setRsvp(eventId: ID, guestId: ID, rsvp: RSVP): Promise<VoyaEvent>;
  /** Invite Voya friends (40, EV04). People already on the list or hosting are skipped. */
  invite(eventId: ID, personIds: ID[]): Promise<VoyaEvent>;
  /** Add a guest by name only (not on Voya). */
  addGuest(eventId: ID, displayName: string): Promise<VoyaEvent>;
  /** 40: remove a guest or withdraw an invitation. */
  removeGuest(eventId: ID, guestId: ID): Promise<VoyaEvent>;
  /** EV06, one item at a time. */
  upsertScheduleItem(eventId: ID, item: Partial<EventScheduleItem> & { id?: ID }): Promise<VoyaEvent>;
  removeScheduleItem(eventId: ID, itemId: ID): Promise<VoyaEvent>;
  /**
   * 23 "Save schedule": replaces the schedule. `baseVersion` is the version the
   * editor started from; if someone saved in between, this fails with `conflict`.
   */
  saveSchedule(eventId: ID, items: Partial<EventScheduleItem>[], baseVersion: number): Promise<VoyaEvent>;
  /** EV03 (hosts only). Guests who become co-hosts leave the guest list. */
  addCohosts(eventId: ID, personIds: ID[]): Promise<VoyaEvent>;
  setHostRole(eventId: ID, personId: ID, role: 'host' | 'co-host'): Promise<VoyaEvent>;
  removeHost(eventId: ID, personId: ID): Promise<VoyaEvent>;
  setCohostPermissions(eventId: ID, permissions: CohostPermissions): Promise<VoyaEvent>;
  /** EV01 "Cancel event" (hosts only). The event stays, read-only, for everyone. */
  cancel(eventId: ID): Promise<VoyaEvent>;
  /** Host-only fields are stripped here, exactly as the server will strip them. */
  guestProjection(eventId: ID): Promise<VoyaEvent>;
}

export interface TripInput {
  /** 03: a city from the catalog. */
  destination: string;
  /** 04: date-only "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
  title?: string;
}

export interface TripsService {
  /** 03–04: the creator becomes the organizer. */
  create(input: TripInput): Promise<Trip>;
  /** T02 (organizer). `coverUri: null` removes a picked cover. */
  update(tripId: ID, patch: Partial<TripInput> & { accommodation?: string; coverUri?: string | null }): Promise<Trip>;
  /** 05 / T03 / T04: invite friends; people already on the trip are skipped. */
  invite(tripId: ID, personIds: ID[]): Promise<Trip>;
  /** 12: the signed-in person joins or declines their invitation. */
  respond(tripId: ID, answer: 'join' | 'decline'): Promise<Trip>;
  /** T03 (organizer): remove a traveler or withdraw an invitation. */
  removeTraveler(tripId: ID, personId: ID): Promise<Trip>;
  /** T03 (organizer): hand the organizer role to another traveler. */
  makeOrganizer(tripId: ID, personId: ID): Promise<Trip>;
  /** 06: the signed-in traveler's preferences for this trip only. */
  setPreferences(tripId: ID, prefs: Omit<TripPreferences, 'savedAt'>): Promise<Trip>;
  /** 07: the signed-in traveler's pick for a place (null clears it). "Must do" adds a must-do. */
  pick(tripId: ID, placeId: ID, pick: TripPick | null): Promise<Trip>;
  /** 07 "Continue": the signed-in traveler is done choosing. */
  finishChoosing(tripId: ID): Promise<Trip>;
  /** Must-do on or off for the signed-in traveler (E09 Add to Plan uses the same record). */
  setMustDo(tripId: ID, placeId: ID, on: boolean): Promise<Trip>;
  /**
   * 08 "Build our trip" / regenerate (organizer). Deterministic mock: the same
   * inputs give the same days. Locked stops are kept. With an itinerary
   * already there, it is only rebuilt when `rebuild` is true.
   */
  generateItinerary(tripId: ID, options?: { rebuild?: boolean }): Promise<Trip>;
  /** 10 (organizer): lock or unlock a stop's time. */
  toggleLock(tripId: ID, itemId: ID): Promise<Trip>;
  /** 10/11 (organizer): replace a stop's place. Locked stops refuse. */
  replaceItem(tripId: ID, itemId: ID, placeId: ID): Promise<Trip>;
  /** 10 "Move" (organizer): another day and/or start time. */
  moveItem(tripId: ID, itemId: ID, to: { date: string; minutes: number }): Promise<Trip>;
  /** 10 "Change duration" (organizer). */
  setDuration(tripId: ID, itemId: ID, minutes: number): Promise<Trip>;
  /** 10 "Remove" (organizer). Locked stops refuse. */
  removeItem(tripId: ID, itemId: ID): Promise<Trip>;
  /** 11: a traveler suggests replacing a stop; the organizer decides. */
  suggestReplacement(tripId: ID, itemId: ID, suggestion: { placeId?: ID; note?: string }): Promise<Trip>;
  /** 11 "Keep original" (organizer): clears the stop's replacement requests. */
  keepOriginal(tripId: ID, itemId: ID): Promise<Trip>;
  /** T01 Delete trip (organizer): removes it for everyone. */
  remove(tripId: ID): Promise<void>;
}

/**
 * Reference data the UI needs to render pickers and names. Today it is read
 * from fixtures; later it comes from the API (people from plan membership).
 */
export interface CatalogService {
  cities(): Promise<string[]>;
  /** Explore category chips (E01/E03). */
  categories(): Promise<PlaceCategory[]>;
  /** Taste interests offered in onboarding (A08) and Manage interests (V13). */
  interests(): Promise<string[]>;
  /** "Popular near you" search suggestions (E10). */
  popularSearches(): Promise<string[]>;
  /** Cities the location picker knows (E02), with their country. */
  destinations(): Promise<{ city: string; country: string }[]>;
  /** Where the map centres for a city (mock "where you are"). */
  cityCenter(city: string): Promise<{ latitude: number; longitude: number } | null>;
  /** E02 "Somewhere to dream about". */
  dreamDestinations(): Promise<{ city: string; country: string }[]>;
  people(): Promise<Person[]>;
}

export interface NotificationsService {
  list(): Promise<ActivityEntry[]>;
  markAllRead(): Promise<void>;
  unreadCount(): Promise<number>;
}

export interface Services {
  auth: AuthService;
  profile: ProfileService;
  places: PlacesService;
  saved: SavedService;
  plans: PlansService;
  invitations: InvitationsService;
  hangouts: HangoutsService;
  events: EventsService;
  trips: TripsService;
  notifications: NotificationsService;
  catalog: CatalogService;
}
