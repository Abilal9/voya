import { Capability as DbCapability, PlanRole as DbPlanRole } from '@prisma/client';
import type { Capability, PlanRole } from '@voya/contracts';

/**
 * Postgres stores the contract spellings (`plan.edit`, `co-host`) via
 * Prisma's @map, but Prisma's TypeScript enum keys cannot contain `.` or `-`.
 * These are the only translations between the two; use them at the edge.
 */
const CAPABILITY_TO_DB: Record<Capability, DbCapability> = {
  'plan.edit': DbCapability.plan_edit,
  'plan.delete': DbCapability.plan_delete,
  'member.manage': DbCapability.member_manage,
  'invite.create': DbCapability.invite_create,
  'suggestion.create': DbCapability.suggestion_create,
  'vote.cast': DbCapability.vote_cast,
  'timeline.finalize': DbCapability.timeline_finalize,
  'schedule.edit': DbCapability.schedule_edit,
  'rsvp.own': DbCapability.rsvp_own,
};

const ROLE_TO_DB: Record<PlanRole, DbPlanRole> = {
  organizer: DbPlanRole.organizer,
  'co-organizer': DbPlanRole.co_organizer,
  traveler: DbPlanRole.traveler,
  participant: DbPlanRole.participant,
  host: DbPlanRole.host,
  'co-host': DbPlanRole.co_host,
  guest: DbPlanRole.guest,
};

const invert = <K extends string, V extends string>(map: Record<K, V>): Record<V, K> =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;

const CAPABILITY_FROM_DB = invert(CAPABILITY_TO_DB);
const ROLE_FROM_DB = invert(ROLE_TO_DB);

export const capabilityToDb = (value: Capability): DbCapability => CAPABILITY_TO_DB[value];
export const capabilityFromDb = (value: DbCapability): Capability => CAPABILITY_FROM_DB[value];
export const roleToDb = (value: PlanRole): DbPlanRole => ROLE_TO_DB[value];
export const roleFromDb = (value: DbPlanRole): PlanRole => ROLE_FROM_DB[value];
