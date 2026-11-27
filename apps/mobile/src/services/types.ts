/**
 * Voya domain models.
 *
 * These are the shapes the UI consumes. They are deliberately provider-agnostic:
 * the mock services and the future NestJS API client must both satisfy them.
 * Optional fields are optional because real provider data is incomplete — see
 * src/mocks/fixtures.ts, where ~35% of places are deliberately damaged.
 */

export type ID = string;

export type PlanType = 'trip' | 'hangout' | 'event';

export type PlanLifecycle = 'draft' | 'active' | 'completed' | 'cancelled';

/** Capability-based, validated per plan type. The role is a label; capabilities decide. */
export type Capability =
  | 'plan.edit'
  | 'plan.delete'
  | 'member.manage'
  | 'invite.create'
  | 'suggestion.create'
  | 'vote.cast'
  | 'timeline.finalize'
  | 'schedule.edit'
  | 'rsvp.own';

export type PlanRole =
  | 'organizer'
  | 'co-organizer'
  | 'traveler'
  | 'participant'
  | 'host'
  | 'co-host'
  | 'guest';

export interface Person {
  id: ID;
  firstName: string;
  lastName?: string;
  displayName: string;
  city?: string;
  bio?: string;
}

export interface Account extends Person {
  /**
   * The identity this account uses in plan membership. Defaults to `id`.
   * Only the development test account sets it (to plan as the seeded Ahmad).
   */
  personId?: ID;
  email: string;
  /** false until the A06 code is entered. Seeded accounts are verified. */
  emailVerified?: boolean;
  onboardingStep: OnboardingStep;
  onboardingComplete: boolean;
  interests: string[];
  /**
   * Profile photo as an app-local reference ("avatars/<file>"), resolved by
   * the UI against the app's document directory. Absent = initials.
   */
  avatarRef?: string;
}

/** Notification preference keys, as listed on the board (V04). */
export type NotificationKey =
  | 'newSuggestions' | 'votesAndDecisions' | 'planChanges' | 'itineraryReady'
  | 'newInvitations' | 'rsvpUpdates'
  | 'upcomingActivities' | 'scheduleChanges'
  | 'recommendations' | 'productUpdates';

/**
 * Per-account preferences (V04–V06). Stored locally only. Nothing is sent:
 * notifications are not delivered and location is not read in the mock.
 */
export interface AccountSettings {
  notifications: Record<NotificationKey, boolean>;
  /** V06 "Use precise location" — a preference only; no location is read. */
  preciseLocation: boolean;
  /** V06 discovery radius in km. */
  discoveryRadiusKm: number;
  /** H01 per-plan "Notifications" switch: plans this account muted. */
  mutedPlans?: ID[];
}

export type OnboardingStep = 'profile' | 'interests' | 'location' | 'notifications' | 'done';

export type PlaceCategory =
  | 'Food'
  | 'Coffee'
  | 'Dessert'
  | 'Activities'
  | 'Culture'
  | 'Shopping'
  | 'Nature'
  | 'Nightlife'
  | 'Experiences';

export interface Place {
  id: ID;
  name: string;
  /** Secondary descriptor, e.g. "Japanese · Restaurant". */
  type?: string;
  category: PlaceCategory;
  city: string;
  area?: string;
  /** Absent for a meaningful share of real provider results. */
  rating?: number;
  /** '$' | '$$' | '$$$' — absent when the provider has no price level. */
  price?: string;
  /** Local fixture image key. Real photos arrive from the provider later. */
  photo?: string;
  /** First-party recommendation rationale. Never provider content. */
  reason?: string;
  /** Short "About" copy (E08). Absent for many provider records. */
  description?: string;
  /** Today's hours as a sentence, e.g. "Open until 12:00 AM". Absent = unknown. */
  hoursText?: string;
  coordinates?: { latitude: number; longitude: number };
  /** undefined means UNKNOWN, which is not the same as closed. */
  openNow?: boolean;
  permanentlyClosed?: boolean;
  tags?: string[];
}

export interface SavedPlace {
  placeId: ID;
  savedAt: string;
}

export type PlaceSignal = 'like' | 'dislike' | 'none';

export interface PlanMember {
  personId: ID;
  role: PlanRole;
  capabilities: Capability[];
  joinedAt: string;
}

export interface PlanBase {
  id: ID;
  type: PlanType;
  title: string;
  city: string;
  lifecycle: PlanLifecycle;
  ownerId: ID;
  members: PlanMember[];
  startsAt?: string;
  endsAt?: string;
  coverPhoto?: string;
  /** Monotonic; every mutation bumps it. Mirrors the server contract. */
  version: number;
}

export interface TimelineItem {
  id: ID;
  startsAt: string;
  endsAt?: string;
  title: string;
  subtitle?: string;
  placeId?: ID;
  locked?: boolean;
  /** Event only. Host-only items never reach a guest projection. */
  visibility?: 'all_guests' | 'hosts_only';
  travelMinutes?: number;
}

export type TripPace = 'Relaxed' | 'Balanced' | 'Packed';
export type TripDiscovery = 'Iconic spots' | 'Mix' | 'Hidden gems';

/** 06: one traveler's choices for this trip. Never written back to the account. */
export interface TripPreferences {
  interests: string[];
  pace: TripPace;
  discoveries: TripDiscovery;
  savedAt: string;
}

/** 07: "Not for me" / "Must do" / "I like this". */
export type TripPick = 'skip' | 'must' | 'like';

/** 05 / 12: invited travelers. Only `joined` people are members. */
export type TripInviteStatus = 'pending' | 'joined' | 'declined';

export interface TripInvite {
  personId: ID;
  status: TripInviteStatus;
  invitedBy: ID;
  invitedAt: string;
}

/** 11: a traveler asks for a stop to be replaced (optionally with a place). */
export interface TripReplaceRequest {
  id: ID;
  by: ID;
  placeId?: ID;
  note?: string;
  at: string;
}

/**
 * A stop on a trip day. `startsAt`/`endsAt` are floating local wall times
 * ("2026-11-18T09:00:00", no zone): a trip's times are the destination's,
 * not the phone's.
 */
export interface TripItem extends TimelineItem {
  kind?: 'meal' | 'activity' | 'break';
  durationMinutes?: number;
  replaceRequests?: TripReplaceRequest[];
}

export interface TripDay {
  /** Date only, "YYYY-MM-DD". */
  date: string;
  title?: string;
  items: TripItem[];
}

export interface Trip extends PlanBase {
  type: 'trip';
  destination: string;
  country?: string;
  /** Date only, "YYYY-MM-DD"; the canonical trip dates. startsAt/endsAt mirror them. */
  startDate?: string;
  endDate?: string;
  /** T02 "Accommodation / base". */
  accommodation?: string;
  coverRef?: string;
  /** Must-dos from Explore (E09) and from 07; `mustDoBy` says who chose each. */
  mustDoPlaceIds: ID[];
  mustDoBy?: Record<ID, ID[]>;
  invites?: TripInvite[];
  preferences?: Record<ID, TripPreferences>;
  picks?: Record<ID, Record<ID, TripPick>>;
  /** Travelers who finished choosing places (08). */
  doneChoosing?: ID[];
  days: TripDay[];
  generated: boolean;
  generatedAt?: string;
}

export interface HangoutSuggestion {
  id: ID;
  placeId: ID;
  slot: string;
  suggestedBy: ID;
  votes: Record<ID, 'up' | 'down'>;
}

/** How an invited friend answered (17, H03). The organizer is always in. */
export type HangoutResponse = 'pending' | 'in' | 'maybe' | 'declined';

export interface HangoutInvite {
  personId: ID;
  status: HangoutResponse;
  invitedBy: ID;
  invitedAt: string;
}

/** H07 Suggest a change: a proposal; the finalized plan stays as it is. */
export interface HangoutChangeRequest {
  id: ID;
  slot: string;
  placeId?: ID;
  note?: string;
  by: ID;
  at: string;
}

export interface Hangout extends PlanBase {
  type: 'hangout';
  /** Template label, e.g. "Dinner + Activity + Dessert"; slots come from it. */
  template: string;
  suggestions: HangoutSuggestion[];
  finalized: boolean;
  timeline: TimelineItem[];
  /** Everyone invited except the organizer. Optional for older stored data. */
  invites?: HangoutInvite[];
  changeRequests?: HangoutChangeRequest[];
}

export type RSVP = 'going' | 'maybe' | 'declined' | 'pending';

export interface EventGuest {
  id: ID;
  /** Absent for guests added by name only (not on Voya). */
  personId?: ID;
  displayName: string;
  rsvp: RSVP;
  invitedBy?: ID;
  invitedAt?: string;
  respondedAt?: string;
}

/** EV06 fields. `subtitle` is kept as the line shown under the title (location or note). */
export interface EventScheduleItem extends TimelineItem {
  location?: string;
  notes?: string;
  /** Guest instructions, e.g. "Please be seated by 11:05 PM". */
  instructions?: string;
}

/** What co-hosts may manage (EV03 "Manage permissions"). Hosts can do everything. */
export interface CohostPermissions {
  details: boolean;
  guests: boolean;
  schedule: boolean;
}

/** The invitation card's wording (20). Absent = generic wording from the event. */
export interface EventInvitationText {
  eyebrow?: string;
  headline?: string;
  line?: string;
}

export interface VoyaEvent extends PlanBase {
  type: 'event';
  venue?: string;
  description?: string;
  dressCode?: string;
  /** "Important note" (21). */
  note?: string;
  invitation?: EventInvitationText;
  /** App-local picked cover ("covers/<file>"); falls back to `coverPhoto`. */
  coverRef?: string;
  cohostPermissions?: CohostPermissions;
  guests: EventGuest[];
  schedule: EventScheduleItem[];
  /** Guest projection only: the viewer's own guest row. Never stored. */
  viewerGuestId?: ID;
}

export type Plan = Trip | Hangout | VoyaEvent;

export interface Invitation {
  token: string;
  planId: ID;
  planType: PlanType;
  planTitle: string;
  inviterName: string;
  role: PlanRole;
  expired?: boolean;
  revoked?: boolean;
}

export interface ActivityEntry {
  id: ID;
  planId?: ID;
  /** Who caused it, when it was a person. */
  actorId?: ID;
  type: string;
  message: string;
  createdAt: string;
  readAt?: string;
}

/** Normalised failure the UI can render with the S03 error state. */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = true,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
