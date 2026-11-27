import { Prisma } from '@prisma/client';
import type { Capability, PlanRole } from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { capabilityFromDb, capabilityToDb, roleFromDb, roleToDb } from '../database/enums';
import { removePerson, type PlanState } from './plan-document';

/**
 * Loading plans and applying membership changes, shared by the plans and
 * invitations services and by account deletion. Works on whatever client it
 * is given (the root client or a transaction), and holds no state.
 */

type Db = Prisma.TransactionClient;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PLAN_INCLUDE = {
  members: { orderBy: [{ joinedAt: 'asc' }, { profileId: 'asc' }] },
  invitees: {
    include: { profile: { select: { displayName: true } } },
    orderBy: [{ invitedAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.PlanInclude;

type PlanRow = Prisma.PlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

export function toState(row: PlanRow): PlanState {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    city: row.city,
    lifecycle: row.lifecycle,
    ownerId: row.ownerId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    startDate: row.startDate,
    endDate: row.endDate,
    details: (row.details && typeof row.details === 'object' && !Array.isArray(row.details) ? row.details : {}) as Record<
      string,
      unknown
    >,
    version: row.version,
    members: row.members.map((m) => ({
      profileId: m.profileId,
      role: roleFromDb(m.role),
      capabilities: m.capabilities.map(capabilityFromDb),
      joinedAt: m.joinedAt,
      muted: m.muted,
    })),
    invitees: row.invitees.map((i) => ({
      id: i.id,
      profileId: i.profileId,
      displayName: i.profile.displayName,
      status: i.status,
      invitedById: i.invitedById,
      invitedAt: i.invitedAt,
      respondedAt: i.respondedAt,
      muted: i.muted,
    })),
  };
}

export const notFound = () => AppError.notFound('This plan');

/** Loads a plan without locking it (reads). */
export async function loadPlan(db: Db, id: string): Promise<PlanState | null> {
  if (!UUID.test(id)) return null;
  const row = await db.plan.findUnique({ where: { id }, include: PLAN_INCLUDE });
  return row ? toState(row) : null;
}

/**
 * Loads a plan and locks its row until the transaction ends, so two writers
 * on the same plan run one after the other and each sees the other's result.
 */
export async function lockPlan(db: Db, id: string): Promise<PlanState | null> {
  if (!UUID.test(id)) return null;
  const locked = await db.$queryRaw<{ id: string }[]>`SELECT id FROM plans WHERE id = ${id}::uuid FOR UPDATE`;
  if (locked.length === 0) return null;
  return loadPlan(db, id);
}

/** `If-Match` precondition: the version the client last saw must still be current. */
export function assertVersion(plan: PlanState, expected: number | undefined): void {
  if (expected !== undefined && expected !== plan.version) {
    throw new AppError('conflict', 'This plan changed since you opened it. Refresh and try again.');
  }
}

/** A `plan_members` row for a nested create. */
export function memberRow(profileId: string, role: PlanRole, capabilities: Capability[], joinedAt?: Date) {
  return {
    profileId,
    role: roleToDb(role),
    capabilities: capabilities.map(capabilityToDb),
    ...(joinedAt ? { joinedAt } : {}),
  };
}

/**
 * Takes `profileId` off `plan` (leave, removal, account deletion) following
 * `removePerson`, and bumps the version. Returns what happened.
 */
export async function applyRemoval(
  db: Db,
  plan: PlanState,
  profileId: string,
  deleted: boolean,
): Promise<'untouched' | 'plan_deleted' | 'updated'> {
  const removal = removePerson(plan, profileId, deleted);
  if (removal.kind === 'untouched') return 'untouched';
  if (removal.kind === 'plan_deleted') {
    await db.plan.delete({ where: { id: plan.id } });
    return 'plan_deleted';
  }
  await db.planMember.deleteMany({ where: { planId: plan.id, profileId } });
  await db.planInvitee.deleteMany({ where: { planId: plan.id, profileId: { in: [profileId, ...removal.dropInviteeOf] } } });
  if (removal.heir) {
    await db.planMember.update({
      where: { planId_profileId: { planId: plan.id, profileId: removal.heir.profileId } },
      data: { role: roleToDb(removal.heir.role), capabilities: removal.heir.capabilities.map(capabilityToDb) },
    });
  }
  await db.plan.update({
    where: { id: plan.id },
    data: {
      ...(removal.heir ? { ownerId: removal.heir.profileId } : {}),
      details: removal.details as Prisma.InputJsonObject,
      version: { increment: 1 },
    },
  });
  return 'updated';
}

/**
 * Account deletion: takes the person off every plan they own, belong to, are
 * invited to, or are still named in (votes or suggestions on a plan they
 * left), one locked plan at a time. Afterwards nothing references them except
 * rows that cascade with the profile.
 */
export async function removeFromAllPlans(db: Db, profileId: string): Promise<{ updated: number; deleted: number }> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM plans p
    WHERE p.owner_id = ${profileId}::uuid
       OR EXISTS (SELECT 1 FROM plan_members m WHERE m.plan_id = p.id AND m.profile_id = ${profileId}::uuid)
       OR EXISTS (SELECT 1 FROM plan_invitees i WHERE i.plan_id = p.id AND i.profile_id = ${profileId}::uuid)
       OR p.details::text LIKE ${`%${profileId}%`}
    ORDER BY p.id`;
  const counts = { updated: 0, deleted: 0 };
  for (const { id } of rows) {
    const plan = await lockPlan(db, id);
    if (!plan) continue;
    const result = await applyRemoval(db, plan, profileId, true);
    if (result === 'plan_deleted') counts.deleted += 1;
    if (result === 'updated') counts.updated += 1;
  }
  return counts;
}
