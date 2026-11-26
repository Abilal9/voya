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

export interface Trip extends PlanBase {
  type: 'trip';
  destination: string;
  mustDoPlaceIds: ID[];
  days: { date: string; items: TimelineItem[] }[];
  generated: boolean;
}

export interface HangoutSuggestion {
  id: ID;
  placeId: ID;
  slot: string;
  suggestedBy: ID;
  votes: Record<ID, 'up' | 'down'>;
}

export interface Hangout extends PlanBase {
  type: 'hangout';
  template: string;
  suggestions: HangoutSuggestion[];
  finalized: boolean;
  timeline: TimelineItem[];
}

export type RSVP = 'going' | 'maybe' | 'declined' | 'pending';

export interface EventGuest {
  id: ID;
  personId?: ID;
  displayName: string;
  rsvp: RSVP;
}

export interface VoyaEvent extends PlanBase {
  type: 'event';
  venue?: string;
  description?: string;
  dressCode?: string;
  guests: EventGuest[];
  schedule: TimelineItem[];
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
