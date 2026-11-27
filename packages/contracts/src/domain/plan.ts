import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';

/**
 * One Plan concept, three experiences. Mirrors the shared plan fields in
 * apps/mobile/src/services/types.ts (`PlanBase`, `PlanMember`). The
 * type-specific shapes (Trip days, Hangout suggestions, Event guests) are
 * added to these contracts when their APIs are built, not before.
 */
export const PLAN_TYPES = ['trip', 'hangout', 'event'] as const;
export const PlanTypeSchema = z.enum(PLAN_TYPES);
export type PlanType = z.infer<typeof PlanTypeSchema>;

export const PLAN_LIFECYCLES = ['draft', 'active', 'completed', 'cancelled'] as const;
export const PlanLifecycleSchema = z.enum(PLAN_LIFECYCLES);
export type PlanLifecycle = z.infer<typeof PlanLifecycleSchema>;

/** Roles are display labels. Capabilities decide what a member may do. */
export const PLAN_ROLES = [
  'organizer', 'co-organizer', 'traveler', 'participant', 'host', 'co-host', 'guest',
] as const;
export const PlanRoleSchema = z.enum(PLAN_ROLES);
export type PlanRole = z.infer<typeof PlanRoleSchema>;

export const CAPABILITIES = [
  'plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'suggestion.create',
  'vote.cast', 'timeline.finalize', 'schedule.edit', 'rsvp.own',
] as const;
export const CapabilitySchema = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof CapabilitySchema>;

export const PlanMemberSchema = z.object({
  personId: IdSchema,
  role: PlanRoleSchema,
  capabilities: z.array(CapabilitySchema),
  joinedAt: IsoDateTimeSchema,
});
export type PlanMember = z.infer<typeof PlanMemberSchema>;

/** The fields every plan type shares (`PlanBase` in the mobile app). */
export const PlanBaseSchema = z.object({
  id: IdSchema,
  type: PlanTypeSchema,
  title: z.string().min(1),
  city: z.string(),
  lifecycle: PlanLifecycleSchema,
  ownerId: IdSchema,
  members: z.array(PlanMemberSchema),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  coverPhoto: z.string().optional(),
  /** Monotonic; every mutation bumps it. Used for optimistic concurrency. */
  version: z.number().int().nonnegative(),
});
export type PlanBase = z.infer<typeof PlanBaseSchema>;

// ------------------------------------------------------------------ shapes
//
// The three experiences as the app consumes them (`Trip`, `Hangout`,
// `VoyaEvent` in apps/mobile/src/services/types.ts). B2 serves them whole;
// their type-specific state is stored in `plans.details` until B3 gives each
// experience its own tables. Person ids are profile ids, place ids place ids.

export const TimelineItemSchema = z.object({
  id: IdSchema,
  startsAt: z.string(),
  endsAt: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  placeId: IdSchema.optional(),
  locked: z.boolean().optional(),
  /** Event only. Host-only items never reach a guest projection. */
  visibility: z.enum(['all_guests', 'hosts_only']).optional(),
  travelMinutes: z.number().optional(),
});
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export const TripPaceSchema = z.enum(['Relaxed', 'Balanced', 'Packed']);
export const TripDiscoverySchema = z.enum(['Iconic spots', 'Mix', 'Hidden gems']);
export const TripPickSchema = z.enum(['skip', 'must', 'like']);

export const TripPreferencesSchema = z.object({
  interests: z.array(z.string()),
  pace: TripPaceSchema,
  discoveries: TripDiscoverySchema,
  savedAt: z.string(),
});
export type TripPreferences = z.infer<typeof TripPreferencesSchema>;

export const TripInviteStatusSchema = z.enum(['pending', 'joined', 'declined']);
export const TripInviteSchema = z.object({
  personId: IdSchema,
  status: TripInviteStatusSchema,
  invitedBy: IdSchema,
  invitedAt: z.string(),
});
export type TripInvite = z.infer<typeof TripInviteSchema>;

export const TripReplaceRequestSchema = z.object({
  id: IdSchema,
  by: IdSchema,
  placeId: IdSchema.optional(),
  note: z.string().optional(),
  at: z.string(),
});

export const TripItemSchema = TimelineItemSchema.extend({
  kind: z.enum(['meal', 'activity', 'break']).optional(),
  durationMinutes: z.number().optional(),
  replaceRequests: z.array(TripReplaceRequestSchema).optional(),
});
export type TripItem = z.infer<typeof TripItemSchema>;

export const TripDaySchema = z.object({
  date: z.string(),
  title: z.string().optional(),
  items: z.array(TripItemSchema),
});
export type TripDay = z.infer<typeof TripDaySchema>;

export const TripSchema = PlanBaseSchema.extend({
  type: z.literal('trip'),
  destination: z.string(),
  country: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accommodation: z.string().optional(),
  coverRef: z.string().optional(),
  mustDoPlaceIds: z.array(IdSchema),
  mustDoBy: z.record(z.array(IdSchema)).optional(),
  invites: z.array(TripInviteSchema).optional(),
  preferences: z.record(TripPreferencesSchema).optional(),
  picks: z.record(z.record(TripPickSchema)).optional(),
  doneChoosing: z.array(IdSchema).optional(),
  days: z.array(TripDaySchema),
  generated: z.boolean(),
  generatedAt: z.string().optional(),
});
export type Trip = z.infer<typeof TripSchema>;

export const HangoutSuggestionSchema = z.object({
  id: IdSchema,
  placeId: IdSchema,
  slot: z.string(),
  suggestedBy: IdSchema,
  votes: z.record(z.enum(['up', 'down'])),
});

export const HangoutResponseSchema = z.enum(['pending', 'in', 'maybe', 'declined']);
export const HangoutInviteSchema = z.object({
  personId: IdSchema,
  status: HangoutResponseSchema,
  invitedBy: IdSchema,
  invitedAt: z.string(),
});
export type HangoutInvite = z.infer<typeof HangoutInviteSchema>;

export const HangoutChangeRequestSchema = z.object({
  id: IdSchema,
  slot: z.string(),
  placeId: IdSchema.optional(),
  note: z.string().optional(),
  by: IdSchema,
  at: z.string(),
});

export const HangoutSchema = PlanBaseSchema.extend({
  type: z.literal('hangout'),
  template: z.string(),
  suggestions: z.array(HangoutSuggestionSchema),
  finalized: z.boolean(),
  timeline: z.array(TimelineItemSchema),
  invites: z.array(HangoutInviteSchema).optional(),
  changeRequests: z.array(HangoutChangeRequestSchema).optional(),
});
export type Hangout = z.infer<typeof HangoutSchema>;

export const RsvpSchema = z.enum(['going', 'maybe', 'declined', 'pending']);
export type Rsvp = z.infer<typeof RsvpSchema>;

export const EventGuestSchema = z.object({
  id: IdSchema,
  /** Absent for guests added by name only, and for other guests in a guest view. */
  personId: IdSchema.optional(),
  displayName: z.string(),
  rsvp: RsvpSchema,
  invitedBy: IdSchema.optional(),
  invitedAt: z.string().optional(),
  respondedAt: z.string().optional(),
});
export type EventGuest = z.infer<typeof EventGuestSchema>;

export const EventScheduleItemSchema = TimelineItemSchema.extend({
  location: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
});
export type EventScheduleItem = z.infer<typeof EventScheduleItemSchema>;

export const CohostPermissionsSchema = z.object({
  details: z.boolean(),
  guests: z.boolean(),
  schedule: z.boolean(),
});
export type CohostPermissions = z.infer<typeof CohostPermissionsSchema>;

export const EventInvitationTextSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string().optional(),
  line: z.string().optional(),
});

export const VoyaEventSchema = PlanBaseSchema.extend({
  type: z.literal('event'),
  venue: z.string().optional(),
  description: z.string().optional(),
  dressCode: z.string().optional(),
  note: z.string().optional(),
  invitation: EventInvitationTextSchema.optional(),
  coverRef: z.string().optional(),
  cohostPermissions: CohostPermissionsSchema.optional(),
  guests: z.array(EventGuestSchema),
  schedule: z.array(EventScheduleItemSchema),
  /** Guest projection only: the viewer's own guest row. */
  viewerGuestId: IdSchema.optional(),
});
export type VoyaEvent = z.infer<typeof VoyaEventSchema>;

export const PlanSchema = z.discriminatedUnion('type', [TripSchema, HangoutSchema, VoyaEventSchema]);
export type Plan = z.infer<typeof PlanSchema>;

/** What an invitation link opens (`Invitation` in the app). */
export const InvitationSchema = z.object({
  token: z.string(),
  planId: IdSchema,
  planType: PlanTypeSchema,
  planTitle: z.string(),
  inviterName: z.string(),
  role: PlanRoleSchema,
  expired: z.boolean().optional(),
  revoked: z.boolean().optional(),
});
export type Invitation = z.infer<typeof InvitationSchema>;
