import { Injectable } from '@nestjs/common';
import { Prisma, type Profile } from '@prisma/client';
import type {
  Capability,
  CreateEventRequest,
  CreateHangoutRequest,
  CreateTripRequest,
  Person,
  Plan,
} from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { can, projectFor, relationOf, sortPast, sortUpcoming, timingOf, type PlanState } from './plan-document';
import { PLAN_INCLUDE, applyRemoval, assertVersion, lockPlan, loadPlan, memberRow, notFound, toState } from './plan-store';

/** Capabilities a creator gets, per experience (as the app's mock grants them). */
export const CREATOR_CAPABILITIES: Record<Plan['type'], Capability[]> = {
  hangout: ['plan.edit', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'],
  trip: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'],
  event: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'schedule.edit'],
};

/** Board default for "Manage permissions" (EV03). */
const DEFAULT_COHOST_PERMISSIONS = { details: false, guests: true, schedule: true };

/** Where an event is when its creator gives no city (the app's default). */
const DEFAULT_EVENT_CITY = 'Riyadh';

/**
 * Plans for the signed-in caller. Every read and write starts from the
 * caller's relation to the plan (member, guest, invited, none); a plan the
 * caller may not see is `not_found`, the same answer as a plan that does not
 * exist. Writes lock the plan row and bump its version.
 */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(profile: Profile, timing: 'upcoming' | 'past', now = Date.now()): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({
      where: {
        OR: [{ members: { some: { profileId: profile.id } } }, { invitees: { some: { profileId: profile.id } } }],
      },
      include: PLAN_INCLUDE,
    });
    return rows
      .map(toState)
      .filter((p) => relationOf(p, profile.id) !== 'none' && timingOf(p, now) === timing)
      .sort(timing === 'upcoming' ? sortUpcoming : sortPast)
      .map((p) => projectFor(p, profile.id)!);
  }

  async get(profile: Profile, id: string): Promise<Plan> {
    const plan = await loadPlan(this.prisma, id);
    const view = plan ? projectFor(plan, profile.id) : null;
    if (!view) throw notFound();
    return view;
  }

  /**
   * Everyone the caller plans with: on plans the caller is a member of, the
   * other members and invitees; on plans the caller is only a guest of or
   * invited to, the members (hosts, organizer) — never the other guests.
   * This is the people catalogue the app's pickers and names come from.
   */
  async people(profile: Profile): Promise<Person[]> {
    const ids = await this.connectedIds(this.prisma, profile.id);
    ids.add(profile.id);
    const rows = await this.prisma.profile.findMany({ where: { id: { in: [...ids] } }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }] });
    return rows.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      ...(p.lastName ? { lastName: p.lastName } : {}),
      displayName: p.displayName,
      ...(p.city ? { city: p.city } : {}),
      ...(p.bio ? { bio: p.bio } : {}),
    }));
  }

  async createHangout(profile: Profile, input: CreateHangoutRequest): Promise<Plan> {
    return this.prisma.$transaction(async (tx) => {
      const invitees = await this.requireConnected(tx, profile.id, input.invitees);
      const plan = await tx.plan.create({
        data: {
          type: 'hangout',
          title: input.title,
          city: input.city,
          ownerId: profile.id,
          startsAt: new Date(input.startsAt),
          details: { template: input.template, suggestions: [], finalized: false, timeline: [], changeRequests: [] },
          members: { create: [memberRow(profile.id, 'organizer', CREATOR_CAPABILITIES.hangout)] },
          invitees: { create: invitees.map((profileId) => ({ profileId, invitedById: profile.id })) },
        },
      });
      return this.view(tx, plan.id, profile.id);
    });
  }

  async createEvent(profile: Profile, input: CreateEventRequest): Promise<Plan> {
    return this.prisma.$transaction(async (tx) => {
      const hosts = await this.requireConnected(tx, profile.id, input.hosts);
      const joinedAt = new Date();
      const plan = await tx.plan.create({
        data: {
          type: 'event',
          title: input.title,
          city: input.city ?? DEFAULT_EVENT_CITY,
          ownerId: profile.id,
          startsAt: new Date(input.startsAt),
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          details: {
            venue: input.venue,
            ...(input.description ? { description: input.description } : {}),
            cohostPermissions: DEFAULT_COHOST_PERMISSIONS,
            guests: [],
            schedule: [],
          },
          members: {
            create: [profile.id, ...hosts].map((id, i) =>
              // Strictly increasing join times keep the creator first in the hand-over order.
              memberRow(id, 'host', CREATOR_CAPABILITIES.event, new Date(joinedAt.getTime() + i)),
            ),
          },
        },
      });
      return this.view(tx, plan.id, profile.id);
    });
  }

  /**
   * Trip dates are the destination's calendar dates. Without the
   * destination's time zone the server anchors them in UTC for ordering
   * (start 00:00, end 23:59); the app shows the dates themselves.
   */
  async createTrip(profile: Profile, input: CreateTripRequest): Promise<Plan> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          type: 'trip',
          title: input.title ?? input.destination,
          city: input.destination,
          ownerId: profile.id,
          startDate: new Date(`${input.startDate}T00:00:00Z`),
          endDate: new Date(`${input.endDate}T00:00:00Z`),
          startsAt: new Date(`${input.startDate}T00:00:00Z`),
          endsAt: new Date(`${input.endDate}T23:59:00Z`),
          details: {
            destination: input.destination,
            ...(input.country ? { country: input.country } : {}),
            mustDoPlaceIds: [], mustDoBy: {}, preferences: {}, picks: {}, doneChoosing: [], days: [], generated: false,
          },
          members: { create: [memberRow(profile.id, 'organizer', CREATOR_CAPABILITIES.trip)] },
        },
      });
      return this.view(tx, plan.id, profile.id);
    });
  }

  /**
   * Leaving takes the caller's membership or invitation off the plan; the
   * plan stays for everyone else (see `removePerson` for the hand-over).
   */
  async leave(profile: Profile, id: string, expectedVersion?: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, id);
      if (!plan || relationOf(plan, profile.id) === 'none') throw notFound();
      assertVersion(plan, expectedVersion);
      await applyRemoval(tx, plan, profile.id, false);
    });
  }

  /**
   * Deletes the plan for everyone. Hangouts: the organizer who owns it.
   * Trips: a member with `plan.delete`. Events are cancelled, never deleted,
   * so their guests keep a record of them.
   */
  async remove(profile: Profile, id: string, expectedVersion?: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, id);
      if (!plan || relationOf(plan, profile.id) === 'none') throw notFound();
      if (relationOf(plan, profile.id) !== 'member') throw AppError.forbidden('Only the organizer can delete this plan.');
      if (plan.type === 'event') throw AppError.forbidden('Events are cancelled, not deleted.');
      const allowed = plan.type === 'hangout' ? plan.ownerId === profile.id : can(plan, profile.id, 'plan.delete');
      if (!allowed) throw AppError.forbidden('Only the organizer can delete this plan.');
      assertVersion(plan, expectedVersion);
      await tx.plan.delete({ where: { id: plan.id } });
    });
  }

  /** H01 per-plan notifications switch. Anyone who can see the plan has one. */
  async setMuted(profile: Profile, id: string, muted: boolean): Promise<void> {
    const plan = await loadPlan(this.prisma, id);
    const relation = plan ? relationOf(plan, profile.id) : 'none';
    if (!plan || relation === 'none') throw notFound();
    if (relation === 'member') {
      await this.prisma.planMember.update({ where: { planId_profileId: { planId: plan.id, profileId: profile.id } }, data: { muted } });
    } else {
      await this.prisma.planInvitee.update({ where: { planId_profileId: { planId: plan.id, profileId: profile.id } }, data: { muted } });
    }
  }

  async mutedPlans(profile: Profile): Promise<string[]> {
    const [members, invitees] = await Promise.all([
      this.prisma.planMember.findMany({ where: { profileId: profile.id, muted: true }, select: { planId: true } }),
      this.prisma.planInvitee.findMany({ where: { profileId: profile.id, muted: true }, select: { planId: true } }),
    ]);
    return [...new Set([...members, ...invitees].map((r) => r.planId))].sort();
  }

  // ----------------------------------------------------------------- helpers

  private async view(db: Prisma.TransactionClient, id: string, viewerId: string): Promise<Plan> {
    const plan = (await loadPlan(db, id)) as PlanState;
    return projectFor(plan, viewerId)!;
  }

  /** Profile ids the caller shares a plan with (see `people`). */
  private async connectedIds(db: Prisma.TransactionClient, profileId: string): Promise<Set<string>> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      WITH mine AS (
        SELECT plan_id, true AS full FROM plan_members WHERE profile_id = ${profileId}::uuid
        UNION ALL
        SELECT plan_id, false AS full FROM plan_invitees WHERE profile_id = ${profileId}::uuid
      )
      SELECT m.profile_id AS id FROM plan_members m JOIN mine ON mine.plan_id = m.plan_id
      UNION
      SELECT i.profile_id AS id FROM plan_invitees i JOIN mine ON mine.plan_id = i.plan_id AND mine.full`;
    const ids = new Set(rows.map((r) => r.id));
    ids.delete(profileId);
    return ids;
  }

  /** People named in a create request must be people the caller already plans with. */
  private async requireConnected(db: Prisma.TransactionClient, profileId: string, requested: string[] | undefined) {
    const wanted = [...new Set(requested ?? [])].filter((id) => id !== profileId);
    if (wanted.length === 0) return [];
    const connected = await this.connectedIds(db, profileId);
    if (wanted.some((id) => !connected.has(id))) {
      throw new AppError('validation_failed', 'Some of the details are not valid.', [
        { path: 'body.people', message: 'You can only add people you already plan with. Share an invitation link instead.' },
      ]);
    }
    return wanted;
  }
}
