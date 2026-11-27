import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Invitation as InvitationRow, Profile } from '@prisma/client';
import type {
  AcceptInvitationResponse,
  CreatedInvitation,
  Invitation,
  InvitationSummary,
  PlanRole,
  PlanType,
} from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { roleFromDb, roleToDb } from '../database/enums';
import { can, relationOf, timingOf, type PlanState } from './plan-document';
import { lockPlan, loadPlan, notFound, UUID } from './plan-store';

/** What someone who opens a link becomes, per experience. */
const INVITEE_ROLE: Record<PlanType, PlanRole> = { hangout: 'participant', trip: 'traveler', event: 'guest' };

export const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

const invalid = () => AppError.notFound('This invitation');
const unavailable = () => new AppError('not_found', 'That plan isn’t available anymore.');

/**
 * Invitation links. A link is a random 32-byte token; only its SHA-256 is
 * stored, and the raw token is returned exactly once, to the member who
 * created it. Opening a link (accept) puts the signed-in person on the
 * plan's invite list; answering happens on the plan's own invitation screen,
 * as for an in-app invite. Links expire, and managers can revoke them.
 */
@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(profile: Profile, planId: string, expiresInHours: number, now = new Date()): Promise<CreatedInvitation> {
    const plan = await loadPlan(this.prisma, planId);
    this.requireManager(plan, profile.id);
    if (!isOpen(plan!, now)) throw new AppError('conflict', 'This plan has ended, so it cannot take new people.');
    const token = randomBytes(32).toString('base64url');
    const row = await this.prisma.invitation.create({
      data: {
        planId: plan!.id,
        tokenHash: hashToken(token),
        role: roleToDb(INVITEE_ROLE[plan!.type]),
        createdById: profile.id,
        expiresAt: new Date(now.getTime() + expiresInHours * 3_600_000),
      },
    });
    return { invitation: this.toInvitation(token, plan!, row, profile.firstName, now), summary: summary(row, 0) };
  }

  async list(profile: Profile, planId: string): Promise<InvitationSummary[]> {
    const plan = await loadPlan(this.prisma, planId);
    this.requireManager(plan, profile.id);
    const rows = await this.prisma.invitation.findMany({
      where: { planId: plan!.id },
      include: { _count: { select: { invitees: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((r) => summary(r, r._count.invitees));
  }

  /** Withdraws a link. Repeating it is not an error; people already on the invite list stay. */
  async revoke(profile: Profile, planId: string, invitationId: string): Promise<void> {
    const plan = await loadPlan(this.prisma, planId);
    this.requireManager(plan, profile.id);
    if (!UUID.test(invitationId)) throw invalid();
    const result = await this.prisma.invitation.updateMany({
      where: { id: invitationId, planId: plan!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.invitation.count({ where: { id: invitationId, planId: plan!.id } });
      if (!exists) throw invalid();
    }
  }

  /** What a link opens. Expired and revoked links still resolve, flagged, so the app can say which. */
  async resolve(token: string, now = new Date()): Promise<Invitation> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { createdBy: { select: { firstName: true } } },
    });
    if (!row) throw invalid();
    const plan = await loadPlan(this.prisma, row.planId);
    if (!plan) throw invalid();
    return this.toInvitation(token, plan, row, row.createdBy.firstName, now);
  }

  /**
   * Idempotent: opening the same link again is not an error. A declined
   * hangout or trip invitation goes back to pending; an event guest who
   * already answered keeps their answer.
   */
  async accept(profile: Profile, token: string, now = new Date()): Promise<AcceptInvitationResponse> {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!invitation) throw invalid();
      if (invitation.revokedAt) throw new AppError('revoked', 'This invitation was withdrawn.');
      if (invitation.expiresAt && invitation.expiresAt <= now) throw new AppError('expired', 'This invitation has expired.');
      const plan = await lockPlan(tx, invitation.planId);
      if (!plan || !isOpen(plan, now)) throw unavailable();

      const result = { planId: plan.id, planType: plan.type, alreadyMember: false };
      if (relationOf(plan, profile.id) === 'member') return { ...result, alreadyMember: true };
      const existing = plan.invitees.find((i) => i.profileId === profile.id);
      if (plan.type === 'event' && existing) return { ...result, alreadyMember: existing.status !== 'pending' };
      if (existing?.status === 'pending') return result;

      const fields = { status: 'pending' as const, invitedById: invitation.createdById, invitedAt: now, respondedAt: null, invitationId: invitation.id };
      if (existing) await tx.planInvitee.update({ where: { id: existing.id }, data: fields });
      else await tx.planInvitee.create({ data: { planId: plan.id, profileId: profile.id, ...fields } });
      await tx.plan.update({ where: { id: plan.id }, data: { version: { increment: 1 } } });
      return result;
    });
  }

  // ----------------------------------------------------------------- helpers

  /** Only members who may invite see and manage a plan's links. Others get `not_found` / `forbidden`. */
  private requireManager(plan: PlanState | null, profileId: string): void {
    if (!plan || relationOf(plan, profileId) === 'none') throw notFound();
    if (!can(plan, profileId, 'invite.create')) throw AppError.forbidden('Only the organizer can share invitations.');
  }

  private toInvitation(token: string, plan: PlanState, row: InvitationRow, inviterName: string, now: Date): Invitation {
    return {
      token,
      planId: plan.id,
      planType: plan.type,
      planTitle: plan.title,
      inviterName,
      role: roleFromDb(row.role),
      ...(row.expiresAt && row.expiresAt <= now ? { expired: true } : {}),
      ...(row.revokedAt ? { revoked: true } : {}),
    };
  }
}

/** A plan still takes people while it is neither cancelled nor over. */
function isOpen(plan: PlanState, now: Date): boolean {
  return plan.lifecycle !== 'cancelled' && timingOf(plan, now.getTime()) === 'upcoming';
}

function summary(row: InvitationRow, acceptedCount: number): InvitationSummary {
  return {
    id: row.id,
    planId: row.planId,
    role: roleFromDb(row.role),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    acceptedCount,
  };
}
