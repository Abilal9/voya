import { z } from 'zod';
import { IdSchema, IsoDateSchema, IsoDateTimeSchema } from '../common';
import { PersonSchema } from '../domain/person';
import { InvitationSchema, PlanRoleSchema, PlanSchema, PlanTypeSchema } from '../domain/plan';

/**
 * Plans, membership and invitations (B2): `/api/v1/plans/*`,
 * `/api/v1/invitations/*`, `/api/v1/people`. The caller always comes from the
 * verified token; a plan the caller may not see answers `not_found`, exactly
 * like a missing one.
 */

const UUID = z.string().uuid();

/** Hangout templates and their slots (mirrors HANGOUT_TEMPLATES in the app's hangoutRules). */
export const HANGOUT_TEMPLATE_SLOTS: Record<string, string[]> = {
  Dinner: ['Dinner'],
  'Dinner + Dessert': ['Dinner', 'Dessert'],
  'Dinner + Activity': ['Dinner', 'Activity'],
  'Dinner + Activity + Dessert': ['Dinner', 'Activity', 'Dessert'],
  'Coffee + A walk': ['Coffee', 'A walk'],
  'Activity + Dinner': ['Activity', 'Dinner'],
};

export const PLAN_LIMITS = { title: 80, city: 80, venue: 120, description: 2000, people: 50 } as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const people = z.array(UUID).max(PLAN_LIMITS.people).optional();

/** GET /api/v1/plans?timing= — the caller's upcoming (soonest first) or past (latest first) plans. */
export const ListPlansQuerySchema = z.object({ timing: z.enum(['upcoming', 'past']).default('upcoming') }).strict();
export type ListPlansQuery = z.infer<typeof ListPlansQuerySchema>;

export const PlansListSchema = z.object({ items: z.array(PlanSchema) });
export type PlansList = z.infer<typeof PlansListSchema>;

/** POST /api/v1/plans/hangouts (board 13). Invitees must be people the caller already plans with. */
export const CreateHangoutRequestSchema = z
  .object({
    title: text(PLAN_LIMITS.title),
    city: text(PLAN_LIMITS.city),
    template: z.string().refine((t) => t in HANGOUT_TEMPLATE_SLOTS, 'Unknown template'),
    startsAt: IsoDateTimeSchema,
    invitees: people,
  })
  .strict();
export type CreateHangoutRequest = z.input<typeof CreateHangoutRequestSchema>;

/** POST /api/v1/plans/events (board 18). Covers arrive with the event API (B3). */
export const CreateEventRequestSchema = z
  .object({
    title: text(PLAN_LIMITS.title),
    venue: text(PLAN_LIMITS.venue),
    city: text(PLAN_LIMITS.city).optional(),
    startsAt: IsoDateTimeSchema,
    endsAt: IsoDateTimeSchema.optional(),
    description: z.string().trim().max(PLAN_LIMITS.description).optional(),
    hosts: people,
  })
  .strict()
  .refine((e) => !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt), {
    message: 'The end must be after the start',
    path: ['endsAt'],
  });
export type CreateEventRequest = z.input<typeof CreateEventRequestSchema>;

/** POST /api/v1/plans/trips (boards 03–04). Dates are the destination's calendar dates. */
export const CreateTripRequestSchema = z
  .object({
    destination: text(PLAN_LIMITS.city),
    country: text(PLAN_LIMITS.city).optional(),
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
    title: text(PLAN_LIMITS.title).optional(),
  })
  .strict()
  .refine((t) => t.endDate >= t.startDate, { message: 'The trip must end on or after its start', path: ['endDate'] });
export type CreateTripRequest = z.input<typeof CreateTripRequestSchema>;

/** PUT /api/v1/plans/:id/mute (H01 "Notifications"). */
export const MutePlanRequestSchema = z.object({ muted: z.boolean() }).strict();
export type MutePlanRequest = z.infer<typeof MutePlanRequestSchema>;

/** GET /api/v1/me/muted-plans */
export const MutedPlansSchema = z.object({ planIds: z.array(IdSchema) });
export type MutedPlans = z.infer<typeof MutedPlansSchema>;

/** GET /api/v1/people — everyone the caller plans with (pickers and names). */
export const PeopleListSchema = z.object({ items: z.array(PersonSchema) });
export type PeopleList = z.infer<typeof PeopleListSchema>;

// --------------------------------------------------------------- invitations

/** Raw invitation token: 32 random bytes, base64url. Only its SHA-256 is stored. */
export const InvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, 'Invalid token');

export const INVITATION_EXPIRY_HOURS = { default: 14 * 24, max: 30 * 24 } as const;

/** POST /api/v1/plans/:id/invitations */
export const CreateInvitationRequestSchema = z
  .object({
    expiresInHours: z.number().int().min(1).max(INVITATION_EXPIRY_HOURS.max).default(INVITATION_EXPIRY_HOURS.default),
  })
  .strict();
export type CreateInvitationRequest = z.input<typeof CreateInvitationRequestSchema>;

/** A link as its plan's managers see it. Never carries the token. */
export const InvitationSummarySchema = z.object({
  id: UUID,
  planId: IdSchema,
  role: PlanRoleSchema,
  createdById: IdSchema,
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
  revokedAt: IsoDateTimeSchema.nullable(),
  /** How many people opened it and were put on the plan's invite list. */
  acceptedCount: z.number().int().nonnegative(),
});
export type InvitationSummary = z.infer<typeof InvitationSummarySchema>;

/** The only response that ever contains the raw token. */
export const CreatedInvitationSchema = z.object({
  invitation: InvitationSchema,
  summary: InvitationSummarySchema,
});
export type CreatedInvitation = z.infer<typeof CreatedInvitationSchema>;

export const InvitationSummariesSchema = z.object({ items: z.array(InvitationSummarySchema) });

/** POST /api/v1/invitations/resolve and /accept. The token travels in the body, never in a URL. */
export const InvitationTokenRequestSchema = z.object({ token: InvitationTokenSchema }).strict();
export type InvitationTokenRequest = z.infer<typeof InvitationTokenRequestSchema>;

export const AcceptInvitationResponseSchema = z.object({
  planId: IdSchema,
  planType: PlanTypeSchema,
  alreadyMember: z.boolean(),
});
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>;
