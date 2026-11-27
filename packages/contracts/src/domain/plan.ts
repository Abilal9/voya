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
