import { Injectable } from '@nestjs/common';
import { Prisma, type InviteStatus, type Profile } from '@prisma/client';
import {
  HANGOUT_TEMPLATE_SLOTS,
  UPDATABLE_PLAN_FIELDS,
  type Capability,
  type Plan,
  type PlanRole,
  type UpdatePlanRequest,
} from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { capabilityToDb, roleToDb } from '../database/enums';
import { PrismaService } from '../database/prisma.service';
import { can, forgetInDetails, memberOf, projectFor, relationOf, timingOf, type PlanState } from './plan-document';
import { applyRemoval, assertVersion, lockPlan, loadPlan, memberRow, notFound } from './plan-store';
import { CREATOR_CAPABILITIES, connectedIds } from './plans.service';

/** What an accepted invitee becomes (as the app's mock grants it). */
const JOINER: Record<'hangout' | 'trip', { role: PlanRole; capabilities: Capability[] }> = {
  hangout: { role: 'participant', capabilities: ['suggestion.create', 'vote.cast'] },
  trip: { role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'] },
};

const ANSWER: Record<'accept' | 'maybe' | 'decline', InviteStatus> = { accept: 'accepted', maybe: 'maybe', decline: 'declined' };

type Tx = Prisma.TransactionClient;

/**
 * Shared plan details and membership (B2): edit, cancel, invite people,
 * answer one's own invitation, remove someone, hand the plan over. Every
 * write locks the plan, checks the caller's capabilities on it, honours the
 * `If-Match` version, and bumps the version once.
 */
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async update(profile: Profile, id: string, patch: UpdatePlanRequest, expectedVersion: number | undefined): Promise<Plan> {
    if (expectedVersion === undefined) {
      throw new AppError('validation_failed', 'Some of the details are not valid.', [
        { path: 'header.if-match', message: 'Send the version you are editing' },
      ]);
    }
    return this.writeVisible(profile, id, expectedVersion, async (tx, plan) => {
      if (!can(plan, profile.id, 'plan.edit')) throw AppError.forbidden('Only the organizer can edit this plan.');
      requireOpen(plan);
      const allowed = UPDATABLE_PLAN_FIELDS[plan.type] as readonly string[];
      const refused = Object.keys(patch).filter((k) => !allowed.includes(k));
      if (refused.length > 0) {
        throw new AppError('validation_failed', 'Some of the details are not valid.', refused.map((k) => ({ path: `body.${k}`, message: `Not a ${plan.type} detail` })));
      }
      const data: Prisma.PlanUpdateInput = {};
      const details = structuredClone(plan.details);
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.city !== undefined) data.city = patch.city;

      if (plan.type === 'hangout') {
        if (patch.startsAt !== undefined) data.startsAt = new Date(patch.startsAt);
        if (patch.template !== undefined && patch.template !== details.template) {
          if (details.finalized) throw new AppError('conflict', 'This hangout is already finalized.');
          const slots = HANGOUT_TEMPLATE_SLOTS[patch.template]!;
          details.template = patch.template;
          // Suggestions whose slot still exists are kept (as the app does).
          details.suggestions = (details.suggestions as { slot: string }[]).filter((s) => slots.includes(s.slot));
        }
      } else if (plan.type === 'event') {
        if (patch.venue !== undefined) details.venue = patch.venue;
        if (patch.description !== undefined) {
          if (patch.description) details.description = patch.description;
          else delete details.description;
        }
        const start = patch.startsAt !== undefined ? new Date(patch.startsAt) : plan.startsAt;
        let end = patch.endsAt !== undefined ? (patch.endsAt ? new Date(patch.endsAt) : null) : plan.endsAt;
        // Only the start moved: keep the same length.
        if (patch.startsAt !== undefined && patch.endsAt === undefined && plan.endsAt && plan.startsAt) {
          end = new Date(start!.getTime() + (plan.endsAt.getTime() - plan.startsAt.getTime()));
        }
        if (start && end && end <= start) {
          throw new AppError('validation_failed', 'Some of the details are not valid.', [{ path: 'body.endsAt', message: 'The end must be after the start' }]);
        }
        data.startsAt = start;
        data.endsAt = end;
      } else {
        if (patch.accommodation !== undefined) {
          if (patch.accommodation) details.accommodation = patch.accommodation;
          else delete details.accommodation;
        }
        if (patch.startDate !== undefined || patch.endDate !== undefined) {
          const startDate = patch.startDate ?? plan.startDate?.toISOString().slice(0, 10);
          const endDate = patch.endDate ?? plan.endDate?.toISOString().slice(0, 10);
          if (!startDate || !endDate || endDate < startDate) {
            throw new AppError('validation_failed', 'Some of the details are not valid.', [{ path: 'body.endDate', message: 'The trip must end on or after its start' }]);
          }
          // Moving an itinerary with its dates is trip domain logic (B3).
          if (Array.isArray(details.days) && details.days.length > 0) {
            throw new AppError('conflict', 'This trip already has an itinerary, so its dates cannot move yet.');
          }
          Object.assign(data, tripTimes(startDate, endDate));
        }
      }
      await tx.plan.update({ where: { id: plan.id }, data: { ...data, details: details as Prisma.InputJsonObject, version: { increment: 1 } } });
    });
  }

  /** EV01 "Cancel event": hosts only. The event stays, read-only, for everyone. */
  async cancel(profile: Profile, id: string, expectedVersion: number | undefined): Promise<Plan> {
    return this.writeVisible(profile, id, expectedVersion, async (tx, plan) => {
      if (plan.type !== 'event') throw AppError.forbidden('Only events can be cancelled. Delete the plan instead.');
      const me = memberOf(plan, profile.id);
      if (!me || me.role !== 'host' || !me.capabilities.includes('plan.delete')) throw AppError.forbidden('Only hosts can cancel the event.');
      requireOpen(plan);
      await tx.plan.update({ where: { id: plan.id }, data: { lifecycle: 'cancelled', version: { increment: 1 } } });
    });
  }

  /**
   * In-app invitations (13, 05, 40). Only people the caller already plans
   * with; people already on the plan are skipped; a declined hangout or trip
   * invitation is asked again.
   */
  async invite(profile: Profile, id: string, personIds: string[]): Promise<Plan> {
    return this.writeVisible(profile, id, undefined, async (tx, plan) => {
      if (!can(plan, profile.id, 'invite.create')) throw AppError.forbidden('Only the organizer can invite people.');
      requireOpen(plan);
      const connected = await connectedIds(tx, profile.id);
      const wanted = [...new Set(personIds)];
      if (wanted.some((p) => p !== profile.id && !connected.has(p))) {
        throw new AppError('validation_failed', 'Some of the details are not valid.', [
          { path: 'body.personIds', message: 'You can only invite people you already plan with. Share an invitation link instead.' },
        ]);
      }
      let changed = 0;
      for (const personId of wanted) {
        if (memberOf(plan, personId)) continue;
        const existing = plan.invitees.find((i) => i.profileId === personId);
        if (existing && (plan.type === 'event' || existing.status !== 'declined')) continue;
        const fields = { status: 'pending' as const, invitedById: profile.id, invitedAt: new Date(), respondedAt: null, invitationId: null };
        if (existing) await tx.planInvitee.update({ where: { id: existing.id }, data: fields });
        else await tx.planInvitee.create({ data: { planId: plan.id, profileId: personId, ...fields } });
        changed += 1;
      }
      if (changed > 0) await tx.plan.update({ where: { id: plan.id }, data: { version: { increment: 1 } } });
    });
  }

  /**
   * The caller answers their own invitation; nobody can answer for them.
   * Hangout: in/maybe makes them a participant, can't removes them (and their
   * votes). Trip: join makes them a traveler. Event: the answer is their RSVP;
   * guests never become members.
   */
  async respond(profile: Profile, id: string, answer: 'accept' | 'maybe' | 'decline'): Promise<Plan | null> {
    return this.write(profile, id, undefined, async (tx, plan) => {
      const invite = plan.invitees.find((i) => i.profileId === profile.id);
      if (!invite || (plan.type === 'trip' && invite.status !== 'pending')) {
        throw new AppError('not_found', 'This invitation isn’t available.');
      }
      requireOpen(plan);
      if (plan.type === 'trip' && answer === 'maybe') {
        throw new AppError('validation_failed', 'Some of the details are not valid.', [{ path: 'body.answer', message: 'Join or decline' }]);
      }
      const status = ANSWER[answer];
      if (status === invite.status) return;
      await tx.planInvitee.update({ where: { id: invite.id }, data: { status, respondedAt: new Date() } });

      let details: Record<string, unknown> | undefined;
      if (plan.type !== 'event') {
        const isMember = !!memberOf(plan, profile.id);
        if (status === 'declined' && isMember) {
          await tx.planMember.delete({ where: { planId_profileId: { planId: plan.id, profileId: profile.id } } });
          details = forgetInDetails(plan.type, plan.details, profile.id, false);
        } else if (status !== 'declined' && !isMember) {
          const joiner = JOINER[plan.type];
          await tx.planMember.create({ data: { planId: plan.id, ...memberRow(profile.id, joiner.role, joiner.capabilities) } });
        }
      }
      await tx.plan.update({
        where: { id: plan.id },
        data: { ...(details ? { details: details as Prisma.InputJsonObject } : {}), version: { increment: 1 } },
      });
    }, { invitedMayAnswer: true });
  }

  /** H03 / T03 / 40: a manager removes someone (member or invitee). The owner is never removed. */
  async removePerson(profile: Profile, id: string, personId: string, expectedVersion: number | undefined): Promise<Plan> {
    return this.writeVisible(profile, id, expectedVersion, async (tx, plan) => {
      if (!can(plan, profile.id, 'member.manage')) throw AppError.forbidden('Only the organizer can remove people.');
      if (personId === profile.id) throw new AppError('bad_request', 'Use leave to take yourself off a plan.');
      if (personId === plan.ownerId) throw AppError.forbidden('Hand the plan over before removing its organizer.');
      if (!memberOf(plan, personId) && !plan.invitees.some((i) => i.profileId === personId)) {
        throw new AppError('not_found', 'That person isn’t on this plan.');
      }
      await applyRemoval(tx, plan, personId, false);
    });
  }

  /**
   * T03 "Make organizer": the owner hands the plan to another member,
   * atomically. Hangouts and trips swap the organizer role and capabilities
   * (the old organizer stays as a participant/traveler). Events pass the
   * ownership between hosts; co-hosts become hosts through the event API (B3).
   */
  async transferOwnership(profile: Profile, id: string, personId: string, expectedVersion: number | undefined): Promise<Plan> {
    return this.writeVisible(profile, id, expectedVersion, async (tx, plan) => {
      if (plan.ownerId !== profile.id) throw AppError.forbidden('Only the organizer can hand the plan over.');
      const next = memberOf(plan, personId);
      if (!next || personId === profile.id) throw new AppError('not_found', 'That person isn’t a member of this plan yet.');
      if (plan.type === 'event') {
        if (next.role !== 'host') throw AppError.forbidden('Make them a host first.');
      } else {
        const joiner = JOINER[plan.type];
        await setMember(tx, plan.id, personId, 'organizer', CREATOR_CAPABILITIES[plan.type]);
        await setMember(tx, plan.id, profile.id, joiner.role, joiner.capabilities);
        // The organizer has no invitation of their own.
        if (plan.type === 'hangout') await tx.planInvitee.deleteMany({ where: { planId: plan.id, profileId: personId } });
      }
      await tx.plan.update({ where: { id: plan.id }, data: { ownerId: personId, version: { increment: 1 } } });
    });
  }

  /** Locks, checks visibility and version, runs the change, and returns the caller's fresh view. */
  /** A write after which the caller still sees the plan (they manage it). */
  private async writeVisible(
    profile: Profile,
    id: string,
    expectedVersion: number | undefined,
    change: (tx: Tx, plan: PlanState) => Promise<void>,
  ): Promise<Plan> {
    const view = await this.write(profile, id, expectedVersion, change);
    if (!view) throw notFound();
    return view;
  }

  /**
   * Locks, checks visibility and version, runs the change, and returns the
   * caller's fresh view — or null when the change means the caller may no
   * longer see the plan (declining a hangout or trip).
   */
  private async write(
    profile: Profile,
    id: string,
    expectedVersion: number | undefined,
    change: (tx: Tx, plan: PlanState) => Promise<void>,
    options: { invitedMayAnswer?: boolean } = {},
  ): Promise<Plan | null> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, id);
      const visible = !!plan && relationOf(plan, profile.id) !== 'none';
      // Someone who declined a hangout can still change their answer.
      const answering = !!plan && !!options.invitedMayAnswer && plan.invitees.some((i) => i.profileId === profile.id);
      if (!plan || !(visible || answering)) throw notFound();
      assertVersion(plan, expectedVersion);
      await change(tx, plan);
      const fresh = await loadPlan(tx, plan.id);
      return fresh ? projectFor(fresh, profile.id) : null;
    });
  }
}

async function setMember(tx: Tx, planId: string, profileId: string, role: PlanRole, capabilities: Capability[]) {
  await tx.planMember.update({
    where: { planId_profileId: { planId, profileId } },
    data: { role: roleToDb(role), capabilities: capabilities.map(capabilityToDb) },
  });
}

function requireOpen(plan: PlanState): void {
  if (plan.lifecycle === 'cancelled') throw new AppError('conflict', 'This plan was cancelled.');
  if (timingOf(plan, Date.now()) === 'past') throw new AppError('conflict', 'This plan has already happened.');
}

/** Trip calendar dates, anchored in UTC for ordering (see PlansService.createTrip). */
export function tripTimes(startDate: string, endDate: string) {
  return {
    startDate: new Date(`${startDate}T00:00:00Z`),
    endDate: new Date(`${endDate}T00:00:00Z`),
    startsAt: new Date(`${startDate}T00:00:00Z`),
    endsAt: new Date(`${endDate}T23:59:00Z`),
  };
}
