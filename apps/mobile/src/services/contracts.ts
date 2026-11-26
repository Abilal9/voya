import type {
  Account,
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
  RSVP,
  SavedPlace,
  TimelineItem,
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
}

export interface ProfileService {
  getAccount(): Promise<Account>;
  updateProfile(patch: Partial<Pick<Account, 'firstName' | 'lastName' | 'displayName' | 'city' | 'bio'>>): Promise<Account>;
  setInterests(interests: string[]): Promise<Account>;
  completeOnboardingStep(step: OnboardingStep): Promise<Account>;
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
  createTrip(input: { title: string; destination: string; startsAt: string; endsAt: string }): Promise<Trip>;
  createHangout(input: { title: string; city: string; template: string; startsAt: string }): Promise<Hangout>;
  createEvent(input: { title: string; city: string; startsAt: string; venue?: string }): Promise<VoyaEvent>;
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
  accept(token: string): Promise<{ planId: ID; alreadyMember: boolean }>;
  createForPlan(planId: ID): Promise<Invitation>;
}

export interface HangoutsService {
  suggestPlace(hangoutId: ID, placeId: ID, slot: string): Promise<Hangout>;
  vote(hangoutId: ID, suggestionId: ID, value: 'up' | 'down'): Promise<Hangout>;
  /** Development affordance: lets one device demonstrate group convergence. */
  simulateParticipantVotes(hangoutId: ID): Promise<Hangout>;
  finalize(hangoutId: ID): Promise<Hangout>;
  proposeChange(hangoutId: ID, itemId: ID, placeId: ID): Promise<Hangout>;
}

export interface EventsService {
  setRsvp(eventId: ID, guestId: ID, rsvp: RSVP): Promise<VoyaEvent>;
  addGuest(eventId: ID, displayName: string): Promise<VoyaEvent>;
  upsertScheduleItem(eventId: ID, item: Partial<TimelineItem> & { id?: ID }): Promise<VoyaEvent>;
  removeScheduleItem(eventId: ID, itemId: ID): Promise<VoyaEvent>;
  /** Host-only fields are stripped here, exactly as the server will strip them. */
  guestProjection(eventId: ID): Promise<VoyaEvent>;
}

export interface TripsService {
  setMustDo(tripId: ID, placeId: ID, on: boolean): Promise<Trip>;
  /**
   * Fixture-backed generation. This is NOT the production scheduler — the real
   * deterministic greedy-insertion engine is a later backend milestone.
   */
  generateItinerary(tripId: ID): Promise<Trip>;
  toggleLock(tripId: ID, itemId: ID): Promise<Trip>;
  replaceItem(tripId: ID, itemId: ID, placeId: ID): Promise<Trip>;
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
