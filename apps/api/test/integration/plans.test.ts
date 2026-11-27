import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  AcceptInvitationResponseSchema,
  ApiErrorSchema,
  CreatedInvitationSchema,
  InvitationSchema,
  MutedPlansSchema,
  PeopleListSchema,
  PlanSchema,
  PlansListSchema,
  type Plan,
  type VoyaEvent,
} from '@voya/contracts';
import request from 'supertest';
import { createTestApp } from '../helpers';
import { projectFor } from '../../src/plans/plan-document';
import { PLAN_INCLUDE, toState } from '../../src/plans/plan-store';
import { localEnv, signUpTestUser, type TestUser } from './local-stack';

/**
 * B2 end to end against the local stack: real Supabase users, the API and
 * Postgres. Plans, membership, server-side projections, invitations, version
 * preconditions, mutes and account deletion's plan hand-over.
 */
describe('B2 plans against the local Supabase stack', () => {
  const env = localEnv();
  const prisma = new PrismaClient();
  const run = Date.now();
  const emailFor = (who: string) => `it-b2-${who}-${run}@example.com`;
  let app: INestApplication;

  type Person = TestUser & { profileId: string };
  const as = (user: Pick<TestUser, 'accessToken'>, method: 'get' | 'put' | 'post' | 'delete', path: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.accessToken}`);
  const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;

  async function person(name: string): Promise<Person> {
    const user = await signUpTestUser(env, emailFor(name), { first_name: name });
    const me = await as(user, 'get', '/me').expect(200);
    return { ...user, profileId: (me.body as { profile: { id: string } }).profile.id };
  }

  const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const hangout = async (who: Person, extra: Record<string, unknown> = {}) =>
    PlanSchema.parse(
      (await as(who, 'post', '/plans/hangouts').send({ title: 'Friday', city: 'Riyadh', template: 'Dinner + Dessert', startsAt: soon(3), ...extra }).expect(201)).body,
    );
  const invite = async (who: Person, planId: string, body: Record<string, unknown> = {}) =>
    CreatedInvitationSchema.parse((await as(who, 'post', `/plans/${planId}/invitations`).send(body).expect(201)).body);
  const accept = (who: Person, token: string) => as(who, 'post', '/invitations/accept').send({ token });

  let ahmad: Person;
  let khaled: Person;
  let omar: Person;
  let stranger: Person;

  beforeAll(async () => {
    app = await createTestApp({ env });
    [ahmad, khaled, omar, stranger] = await Promise.all([person('ahmad'), person('khaled'), person('omar'), person('stranger')]);
  });

  afterAll(async () => {
    const ids = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM auth.users WHERE email LIKE ${`it-b2-%-${run}@example.com`}`;
    const profiles = await prisma.profile.findMany({ where: { authUserId: { in: ids.map((r) => r.id) } }, select: { id: true } });
    await prisma.plan.deleteMany({ where: { ownerId: { in: profiles.map((p) => p.id) } } });
    await prisma.profile.deleteMany({ where: { id: { in: profiles.map((p) => p.id) } } });
    await prisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE ${`it-b2-%-${run}@example.com`}`;
    await app.close();
    await prisma.$disconnect();
  });

  it('serves every seeded plan as a valid document to each person on it', async () => {
    const rows = await prisma.plan.findMany({ where: { seedRef: { not: null } }, include: PLAN_INCLUDE });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const state = toState(row);
      for (const id of [...state.members.map((m) => m.profileId), ...state.invitees.map((i) => i.profileId)]) {
        const view = projectFor(state, id);
        if (view) expect(PlanSchema.parse(view)).toEqual(view);
      }
    }
    const wedding = rows.find((r) => r.seedRef === 'plan-wedding')!;
    expect(wedding.invitees.length).toBe(3); // guests on Voya are rows; the name-only guest stays in the document
    expect((wedding.details as { guests: unknown[] }).guests).toHaveLength(1);
  });

  it('creates a hangout for its organizer; nobody else can see it, not even by id', async () => {
    const h = await hangout(ahmad);
    expect(h).toMatchObject({ type: 'hangout', ownerId: ahmad.profileId, version: 1, invites: [] });
    expect(h.members).toEqual([expect.objectContaining({ personId: ahmad.profileId, role: 'organizer' })]);

    const upcoming = PlansListSchema.parse((await as(ahmad, 'get', '/plans?timing=upcoming').expect(200)).body);
    expect(upcoming.items.map((p) => p.id)).toContain(h.id);
    expect(code((await as(stranger, 'get', `/plans/${h.id}`).expect(404)).body)).toBe('not_found');
    expect(code((await as(stranger, 'get', '/plans/not-a-uuid').expect(404)).body)).toBe('not_found');
    expect(PlansListSchema.parse((await as(stranger, 'get', '/plans').expect(200)).body).items.map((p) => p.id)).not.toContain(h.id);
    await as(stranger, 'post', `/plans/${h.id}/leave`).expect(404);
    await as(stranger, 'delete', `/plans/${h.id}`).expect(404);
  });

  it('only lets people be added who already plan with the creator', async () => {
    const res = await as(ahmad, 'post', '/plans/hangouts')
      .send({ title: 'x', city: 'Riyadh', template: 'Dinner', startsAt: soon(2), invitees: [stranger.profileId] })
      .expect(422);
    expect(code(res.body)).toBe('validation_failed');
    await as(ahmad, 'post', '/plans/hangouts').send({ title: 'x', city: 'Riyadh', template: 'Brunch', startsAt: soon(2) }).expect(422);
    await as(ahmad, 'post', '/plans/hangouts').send({ title: 'x', city: 'Riyadh', template: 'Dinner', startsAt: soon(2), id: 'mine' }).expect(422);
  });

  it('invites by link: the raw token is shown once, only its hash is stored, and accepting is idempotent', async () => {
    const h = await hangout(ahmad);
    const created = await invite(ahmad, h.id);
    expect(created.invitation).toMatchObject({ planId: h.id, planType: 'hangout', planTitle: 'Friday', inviterName: 'ahmad', role: 'participant' });
    const token = created.invitation.token;
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: created.summary.id } });
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(row)).not.toContain(token);

    const resolved = InvitationSchema.parse((await as(khaled, 'post', '/invitations/resolve').send({ token }).expect(200)).body);
    expect(resolved).toMatchObject({ planId: h.id, inviterName: 'ahmad' });
    expect(resolved.expired).toBeUndefined();
    await as(khaled, 'post', '/invitations/resolve').send({ token: 'A'.repeat(43) }).expect(404);

    expect(AcceptInvitationResponseSchema.parse((await accept(khaled, token).expect(200)).body)).toEqual({ planId: h.id, planType: 'hangout', alreadyMember: false });
    const seen = PlanSchema.parse((await as(khaled, 'get', `/plans/${h.id}`).expect(200)).body);
    expect(seen.version).toBe(2);
    expect(seen.type === 'hangout' && seen.invites).toEqual([expect.objectContaining({ personId: khaled.profileId, status: 'pending', invitedBy: ahmad.profileId })]);
    await accept(khaled, token).expect(200);
    expect(PlanSchema.parse((await as(khaled, 'get', `/plans/${h.id}`).expect(200)).body).version).toBe(2);
    expect((await accept(ahmad, token).expect(200)).body).toMatchObject({ alreadyMember: true });

    const summaries = (await as(ahmad, 'get', `/plans/${h.id}/invitations`).expect(200)).body as { items: { acceptedCount: number }[] };
    expect(summaries.items[0]?.acceptedCount).toBe(1);
    expect(JSON.stringify(summaries)).not.toContain(token);
    await as(khaled, 'get', `/plans/${h.id}/invitations`).expect(403); // invited, not a manager
    await as(khaled, 'post', `/plans/${h.id}/invitations`).send({}).expect(403);

    // The people catalogue comes from membership, both ways.
    const ahmadsPeople = PeopleListSchema.parse((await as(ahmad, 'get', '/people').expect(200)).body).items.map((p) => p.id);
    expect(ahmadsPeople).toEqual(expect.arrayContaining([ahmad.profileId, khaled.profileId]));
    expect(ahmadsPeople).not.toContain(stranger.profileId);
    const khaledsPeople = PeopleListSchema.parse((await as(khaled, 'get', '/people').expect(200)).body).items.map((p) => p.id);
    expect(khaledsPeople).toEqual(expect.arrayContaining([ahmad.profileId, khaled.profileId]));
  });

  it('refuses revoked and expired links, and says which', async () => {
    const h = await hangout(ahmad);
    const revoked = await invite(ahmad, h.id);
    await as(ahmad, 'delete', `/plans/${h.id}/invitations/${revoked.summary.id}`).expect(204);
    await as(ahmad, 'delete', `/plans/${h.id}/invitations/${revoked.summary.id}`).expect(204); // repeat is fine
    expect(code((await accept(omar, revoked.invitation.token).expect(410)).body)).toBe('revoked');
    expect((await as(omar, 'post', '/invitations/resolve').send({ token: revoked.invitation.token }).expect(200)).body).toMatchObject({ revoked: true });

    const expiring = await invite(ahmad, h.id, { expiresInHours: 1 });
    await prisma.invitation.update({ where: { id: expiring.summary.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(code((await accept(omar, expiring.invitation.token).expect(410)).body)).toBe('expired');
    expect((await as(omar, 'post', '/invitations/resolve').send({ token: expiring.invitation.token }).expect(200)).body).toMatchObject({ expired: true });
    await as(omar, 'get', `/plans/${h.id}`).expect(404);
  });

  it('gives an event guest the guest view, decided on the server', async () => {
    const created = PlanSchema.parse(
      (await as(ahmad, 'post', '/plans/events').send({ title: 'Wedding', venue: 'Hall', startsAt: soon(10), endsAt: soon(11) }).expect(201)).body,
    ) as VoyaEvent;
    expect(created.members).toEqual([expect.objectContaining({ personId: ahmad.profileId, role: 'host' })]);
    const details = (await prisma.plan.findUniqueOrThrow({ where: { id: created.id } })).details as Record<string, unknown>;
    await prisma.plan.update({
      where: { id: created.id },
      data: {
        details: {
          ...details,
          schedule: [
            { id: 's1', startsAt: soon(10), title: 'Dinner' },
            { id: 's2', startsAt: soon(10), title: 'Hosts arrive', visibility: 'hosts_only' },
          ],
        },
      },
    });
    const link = await invite(ahmad, created.id);
    expect(link.invitation.role).toBe('guest');
    await accept(khaled, link.invitation.token).expect(200);
    await accept(omar, link.invitation.token).expect(200);

    const guest = PlanSchema.parse((await as(khaled, 'get', `/plans/${created.id}`).expect(200)).body) as VoyaEvent;
    expect(guest.schedule.map((s) => s.id)).toEqual(['s1']);
    expect(guest.cohostPermissions).toBeUndefined();
    expect(guest.guests).toHaveLength(2);
    expect(guest.guests.every((g) => g.personId === undefined)).toBe(true);
    const own = guest.guests.find((g) => g.id === guest.viewerGuestId);
    expect(own?.displayName).toBe('khaled');
    expect(guest.guests.find((g) => g.id !== guest.viewerGuestId)?.displayName).toBe('');

    const host = PlanSchema.parse((await as(ahmad, 'get', `/plans/${created.id}`).expect(200)).body) as VoyaEvent;
    expect(host.schedule).toHaveLength(2);
    expect(host.guests.map((g) => g.personId).sort()).toEqual([khaled.profileId, omar.profileId].sort());
    // A guest's people catalogue holds the hosts, never the other guests.
    expect(PeopleListSchema.parse((await as(khaled, 'get', '/people').expect(200)).body).items.map((p) => p.id)).not.toContain(omar.profileId);
    // Events are cancelled, not deleted.
    expect(code((await as(ahmad, 'delete', `/plans/${created.id}`).expect(403)).body)).toBe('forbidden');
  });

  it('hands a plan over when its owner leaves, and refuses a stale version', async () => {
    // Khaled already plans with Ahmad (earlier links), so Ahmad can make him a host.
    const event = PlanSchema.parse(
      (await as(ahmad, 'post', '/plans/events').send({ title: 'Dinner party', venue: 'Home', startsAt: soon(5), hosts: [khaled.profileId] }).expect(201)).body,
    );
    expect(event.members.map((m) => m.personId)).toEqual([ahmad.profileId, khaled.profileId]);

    expect(code((await as(ahmad, 'post', `/plans/${event.id}/leave`).set('If-Match', '"99"').expect(409)).body)).toBe('conflict');
    await as(ahmad, 'post', `/plans/${event.id}/leave`).set('If-Match', 'nope').expect(422);
    await as(ahmad, 'post', `/plans/${event.id}/leave`).set('If-Match', `"${event.version}"`).expect(204);

    const after = PlanSchema.parse((await as(khaled, 'get', `/plans/${event.id}`).expect(200)).body);
    expect(after.ownerId).toBe(khaled.profileId);
    expect(after.version).toBe(event.version + 1);
    expect(after.members).toEqual([expect.objectContaining({ personId: khaled.profileId, role: 'host' })]);
    await as(ahmad, 'get', `/plans/${event.id}`).expect(404);
  });

  it('deletes a hangout only for its organizer, with a version precondition', async () => {
    const h = await hangout(ahmad);
    const link = await invite(ahmad, h.id);
    await accept(omar, link.invitation.token).expect(200);
    expect(code((await as(omar, 'delete', `/plans/${h.id}`).expect(403)).body)).toBe('forbidden');
    await as(ahmad, 'delete', `/plans/${h.id}`).set('If-Match', '1').expect(409); // Omar's acceptance bumped it
    await as(ahmad, 'delete', `/plans/${h.id}`).set('If-Match', '2').expect(204);
    await as(omar, 'get', `/plans/${h.id}`).expect(404);
    expect(await prisma.invitation.count({ where: { planId: h.id } })).toBe(0);
  });

  it('keeps per-plan mutes on the server for members and invitees', async () => {
    const h = await hangout(ahmad);
    const link = await invite(ahmad, h.id);
    await accept(omar, link.invitation.token).expect(200);
    await as(ahmad, 'put', `/plans/${h.id}/mute`).send({ muted: true }).expect(204);
    await as(omar, 'put', `/plans/${h.id}/mute`).send({ muted: true }).expect(204);
    expect(MutedPlansSchema.parse((await as(ahmad, 'get', '/me/muted-plans').expect(200)).body).planIds).toContain(h.id);
    expect(MutedPlansSchema.parse((await as(omar, 'get', '/me/muted-plans').expect(200)).body).planIds).toContain(h.id);
    await as(ahmad, 'put', `/plans/${h.id}/mute`).send({ muted: false }).expect(204);
    expect(MutedPlansSchema.parse((await as(ahmad, 'get', '/me/muted-plans').expect(200)).body).planIds).not.toContain(h.id);
    await as(stranger, 'put', `/plans/${h.id}/mute`).send({ muted: true }).expect(404);
  });

  it('files plans by timing and stops a past plan taking people', async () => {
    const past = await hangout(ahmad, { startsAt: new Date(Date.now() - 86_400_000).toISOString() });
    const lists = await Promise.all(['upcoming', 'past'].map(async (t) => PlansListSchema.parse((await as(ahmad, 'get', `/plans?timing=${t}`).expect(200)).body)));
    expect(lists[0]!.items.map((p: Plan) => p.id)).not.toContain(past.id);
    expect(lists[1]!.items.map((p: Plan) => p.id)).toContain(past.id);
    expect(code((await as(ahmad, 'post', `/plans/${past.id}/invitations`).send({}).expect(409)).body)).toBe('conflict');

    const trip = PlanSchema.parse(
      (await as(ahmad, 'post', '/plans/trips').send({ destination: 'Florence', country: 'Italy', startDate: '2030-04-01', endDate: '2030-04-05' }).expect(201)).body,
    );
    expect(trip).toMatchObject({ type: 'trip', title: 'Florence', startDate: '2030-04-01', endDate: '2030-04-05', generated: false, days: [] });
    await as(ahmad, 'post', '/plans/trips').send({ destination: 'Florence', startDate: '2030-04-05', endDate: '2030-04-01' }).expect(422);
  });

  it('deletes an account inside its plans: hand-over, invitations gone, plans nobody is left on removed', async () => {
    const leaving = await person('leaving');
    const friend = await person('friend');
    // friend joins one of leaving's plans by link, so leaving can then make friend a host.
    const solo = await hangout(leaving);
    const link = await invite(leaving, solo.id);
    await accept(friend, link.invitation.token).expect(200);
    const event = PlanSchema.parse(
      (await as(leaving, 'post', '/plans/events').send({ title: 'Party', venue: 'Roof', startsAt: soon(4), hosts: [friend.profileId] }).expect(201)).body,
    );

    await as(leaving, 'delete', '/me').expect(204);

    await as(friend, 'get', `/plans/${solo.id}`).expect(404); // only its organizer was a member: gone
    expect(await prisma.plan.count({ where: { id: solo.id } })).toBe(0);
    const handed = PlanSchema.parse((await as(friend, 'get', `/plans/${event.id}`).expect(200)).body);
    expect(handed.ownerId).toBe(friend.profileId);
    expect(handed.members.map((m) => m.personId)).toEqual([friend.profileId]);
    expect(await prisma.invitation.count({ where: { createdById: leaving.profileId } })).toBe(0);
    expect(await prisma.profile.count({ where: { id: leaving.profileId } })).toBe(0);
    const mentions = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM plans WHERE details::text LIKE ${`%${leaving.profileId}%`} OR owner_id = ${leaving.profileId}::uuid`;
    expect(Number(mentions[0]!.n)).toBe(0);
  });
});
