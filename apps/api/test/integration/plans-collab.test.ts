import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ApiErrorSchema,
  CreatedInvitationSchema,
  PlanSchema,
  RespondToInvitationResponseSchema,
  type Plan,
  type Trip,
  type VoyaEvent,
} from '@voya/contracts';
import request from 'supertest';
import { createTestApp } from '../helpers';
import { localEnv, signUpTestUser, type TestUser } from './local-stack';

/**
 * B2 collaboration scenarios from the brief, with real Supabase users:
 * A shared trip, B event permissions, C invitations (wrong recipient,
 * concurrency, cancelled plans, declines), D ownership, E concurrent edits,
 * F isolation.
 */
describe('B2 shared plans between real accounts', () => {
  const env = localEnv();
  const prisma = new PrismaClient();
  const run = Date.now();
  const emailFor = (who: string) => `it-b2c-${who}-${run}@example.com`;
  let app: INestApplication;

  type Person = TestUser & { profileId: string };
  const as = (user: Pick<TestUser, 'accessToken'>, method: 'get' | 'put' | 'post' | 'delete' | 'patch', path: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.accessToken}`);
  const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;
  const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  async function person(name: string): Promise<Person> {
    const user = await signUpTestUser(env, emailFor(name), { first_name: name });
    const me = await as(user, 'get', '/me').expect(200);
    return { ...user, profileId: (me.body as { profile: { id: string } }).profile.id };
  }
  const plan = (body: unknown) => PlanSchema.parse(body);
  const link = async (who: Person, planId: string) =>
    CreatedInvitationSchema.parse((await as(who, 'post', `/plans/${planId}/invitations`).send({}).expect(201)).body).invitation.token;
  const accept = (who: Person, token: string) => as(who, 'post', '/invitations/accept').send({ token });
  const respond = (who: Person, planId: string, answer: string) => as(who, 'post', `/plans/${planId}/response`).send({ answer });
  const hangout = async (who: Person) =>
    plan((await as(who, 'post', '/plans/hangouts').send({ title: 'Friday', city: 'Riyadh', template: 'Dinner', startsAt: soon(3) }).expect(201)).body);

  let ahmad: Person;
  let khaled: Person;
  let omar: Person;
  let nisreen: Person;

  beforeAll(async () => {
    app = await createTestApp({ env });
    [ahmad, khaled, omar, nisreen] = await Promise.all([person('ahmad'), person('khaled'), person('omar'), person('nisreen')]);
  });

  afterAll(async () => {
    const ids = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM auth.users WHERE email LIKE ${`it-b2c-%-${run}@example.com`}`;
    const profiles = await prisma.profile.findMany({ where: { authUserId: { in: ids.map((r) => r.id) } }, select: { id: true } });
    await prisma.plan.deleteMany({ where: { ownerId: { in: profiles.map((p) => p.id) } } });
    await prisma.profile.deleteMany({ where: { id: { in: profiles.map((p) => p.id) } } });
    await prisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE ${`it-b2c-%-${run}@example.com`}`;
    await app.close();
    await prisma.$disconnect();
  });

  let trip: Trip;

  it('A: shares a trip — invite, join, read, organizer edits, others cannot', async () => {
    trip = plan((await as(ahmad, 'post', '/plans/trips').send({ destination: 'Florence', startDate: '2030-04-01', endDate: '2030-04-05' }).expect(201)).body) as Trip;
    await accept(khaled, await link(ahmad, trip.id)).expect(200);
    expect(plan((await as(khaled, 'get', `/plans/${trip.id}`).expect(200)).body).type).toBe('trip'); // invited: sees the invitation
    const joined = RespondToInvitationResponseSchema.parse((await respond(khaled, trip.id, 'accept').expect(200)).body).plan as Trip;
    expect(joined.members.find((m) => m.personId === khaled.profileId)).toMatchObject({ role: 'traveler' });
    expect(joined.invites).toEqual([expect.objectContaining({ personId: khaled.profileId, status: 'joined' })]);
    await respond(khaled, trip.id, 'maybe').expect(404); // already answered

    await as(omar, 'get', `/plans/${trip.id}`).expect(404);

    await as(ahmad, 'patch', `/plans/${trip.id}`).send({ title: 'Tuscany' }).expect(422); // If-Match required
    await as(ahmad, 'patch', `/plans/${trip.id}`).set('If-Match', String(joined.version)).send({ venue: 'x' }).expect(422); // not a trip field
    const edited = plan(
      (await as(ahmad, 'patch', `/plans/${trip.id}`).set('If-Match', String(joined.version)).send({ title: 'Tuscany', accommodation: 'Villa' }).expect(200)).body,
    ) as Trip;
    expect(edited).toMatchObject({ title: 'Tuscany', accommodation: 'Villa', version: joined.version + 1 });
    expect(plan((await as(khaled, 'get', `/plans/${trip.id}`).expect(200)).body).title).toBe('Tuscany');

    expect(code((await as(khaled, 'patch', `/plans/${trip.id}`).set('If-Match', String(edited.version)).send({ title: 'Mine' }).expect(403)).body)).toBe('forbidden');
    expect(code((await as(omar, 'patch', `/plans/${trip.id}`).set('If-Match', String(edited.version)).send({ title: 'Mine' }).expect(404)).body)).toBe('not_found');
    expect(plan((await as(ahmad, 'get', `/plans/${trip.id}`).expect(200)).body).title).toBe('Tuscany');
  });

  let event: VoyaEvent;

  it('B: event guests read permitted details but cannot change host-only things', async () => {
    event = plan((await as(nisreen, 'post', '/plans/events').send({ title: 'Wedding', venue: 'Hall', startsAt: soon(20), endsAt: soon(21) }).expect(201)).body) as VoyaEvent;
    const token = await link(nisreen, event.id);
    await accept(khaled, token).expect(200);
    const rsvp = RespondToInvitationResponseSchema.parse((await respond(khaled, event.id, 'accept').expect(200)).body).plan as VoyaEvent;
    expect(rsvp.guests.find((g) => g.id === rsvp.viewerGuestId)).toMatchObject({ rsvp: 'going' });
    expect(rsvp.members.map((m) => m.personId)).toEqual([nisreen.profileId]); // guests never become members

    const v = String(rsvp.version);
    await as(khaled, 'patch', `/plans/${event.id}`).set('If-Match', v).send({ venue: 'Garden' }).expect(403);
    await as(khaled, 'post', `/plans/${event.id}/cancel`).expect(403);
    await as(khaled, 'post', `/plans/${event.id}/owner`).send({ personId: khaled.profileId }).expect(403);
    await as(khaled, 'delete', `/plans/${event.id}/people/${nisreen.profileId}`).expect(403);
    await as(khaled, 'get', `/plans/${event.id}/invitations`).expect(403);
    await as(khaled, 'post', `/plans/${event.id}/invitees`).send({ personIds: [omar.profileId] }).expect(403);

    // The host can: edit (moving the start keeps the length) and see the guest by name.
    const host = plan((await as(nisreen, 'patch', `/plans/${event.id}`).set('If-Match', v).send({ venue: 'Garden', startsAt: soon(22) }).expect(200)).body) as VoyaEvent;
    expect(host.venue).toBe('Garden');
    expect(Date.parse(host.endsAt!) - Date.parse(host.startsAt!)).toBe(86_400_000);
    expect(host.guests[0]).toMatchObject({ personId: khaled.profileId, displayName: 'khaled', rsvp: 'going' });
    event = host;
  });

  it('C: invitations belong to their recipient, survive concurrency, and close with the plan', async () => {
    // Khaled plans with Ahmad (trip), so Ahmad can invite him in-app; Omar cannot answer Khaled's invitation.
    const h = await hangout(ahmad);
    plan((await as(ahmad, 'post', `/plans/${h.id}/invitees`).send({ personIds: [khaled.profileId] }).expect(200)).body);
    await as(ahmad, 'post', `/plans/${h.id}/invitees`).send({ personIds: [omar.profileId] }).expect(422); // not connected
    expect(code((await respond(omar, h.id, 'accept').expect(404)).body)).toBe('not_found');

    // Declining hides the hangout; the invitee can still change their mind.
    expect(RespondToInvitationResponseSchema.parse((await respond(khaled, h.id, 'decline').expect(200)).body).plan).toBeNull();
    await as(khaled, 'get', `/plans/${h.id}`).expect(404);
    const back = RespondToInvitationResponseSchema.parse((await respond(khaled, h.id, 'maybe').expect(200)).body).plan!;
    expect(back.members.find((m) => m.personId === khaled.profileId)).toMatchObject({ role: 'participant' });

    // Concurrent acceptance: one row per person, one version bump per new person.
    const token = await link(ahmad, h.id);
    const before = plan((await as(ahmad, 'get', `/plans/${h.id}`).expect(200)).body).version;
    const results = await Promise.all([...Array(4)].map(() => accept(omar, token)).concat([accept(nisreen, token), accept(nisreen, token)]));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(await prisma.planInvitee.count({ where: { planId: h.id, profileId: omar.profileId } })).toBe(1);
    expect(await prisma.planInvitee.count({ where: { planId: h.id, profileId: nisreen.profileId } })).toBe(1);
    expect(plan((await as(ahmad, 'get', `/plans/${h.id}`).expect(200)).body).version).toBe(before + 2);

    // Already a member: accepting again changes nothing.
    expect((await accept(khaled, token).expect(200)).body).toMatchObject({ alreadyMember: true });

    // A cancelled event takes nobody new.
    const eventToken = await link(nisreen, event.id);
    await as(nisreen, 'post', `/plans/${event.id}/cancel`).set('If-Match', String(event.version)).expect(200);
    expect(code((await accept(omar, eventToken).expect(404)).body)).toBe('not_found');
    await as(nisreen, 'patch', `/plans/${event.id}`).set('If-Match', String(event.version + 1)).send({ title: 'x' }).expect(409);
    await respond(khaled, event.id, 'decline').expect(409); // cancelled: read-only
  });

  it('D: hands a trip over atomically, removes people, and drops a plan its last member leaves', async () => {
    const current = plan((await as(ahmad, 'get', `/plans/${trip.id}`).expect(200)).body);
    await as(ahmad, 'post', `/plans/${trip.id}/owner`).set('If-Match', String(current.version - 1)).send({ personId: khaled.profileId }).expect(409);
    await as(ahmad, 'post', `/plans/${trip.id}/owner`).send({ personId: omar.profileId }).expect(404); // not a member
    const handed = plan((await as(ahmad, 'post', `/plans/${trip.id}/owner`).set('If-Match', String(current.version)).send({ personId: khaled.profileId }).expect(200)).body);
    expect(handed.ownerId).toBe(khaled.profileId);
    expect(handed.members.find((m) => m.personId === khaled.profileId)).toMatchObject({ role: 'organizer', capabilities: expect.arrayContaining(['plan.delete']) });
    expect(handed.members.find((m) => m.personId === ahmad.profileId)).toMatchObject({ role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'] });
    await as(ahmad, 'delete', `/plans/${trip.id}`).expect(403);

    await as(khaled, 'delete', `/plans/${trip.id}/people/${khaled.profileId}`).expect(400); // use leave
    const removed = plan((await as(khaled, 'delete', `/plans/${trip.id}/people/${ahmad.profileId}`).expect(200)).body);
    expect(removed.members.map((m) => m.personId)).toEqual([khaled.profileId]);
    await as(ahmad, 'get', `/plans/${trip.id}`).expect(404);

    await as(khaled, 'post', `/plans/${trip.id}/leave`).expect(204);
    expect(await prisma.plan.count({ where: { id: trip.id } })).toBe(0);
  });

  it('E: of two concurrent edits from the same version, exactly one wins and nothing is overwritten', async () => {
    // Omar joins one of Nisreen's plans by link, so she can then make him a host.
    const meetup = await hangout(nisreen);
    await accept(omar, await link(nisreen, meetup.id)).expect(200);
    const party = plan((await as(nisreen, 'post', '/plans/events').send({ title: 'Party', venue: 'Roof', startsAt: soon(9), hosts: [omar.profileId] }).expect(201)).body);
    const [a, b] = await Promise.all([
      as(nisreen, 'patch', `/plans/${party.id}`).set('If-Match', String(party.version)).send({ title: 'By Nisreen' }),
      as(omar, 'patch', `/plans/${party.id}`).set('If-Match', String(party.version)).send({ title: 'By Omar' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = (a.status === 200 ? a : b).body as Plan;
    const after = plan((await as(omar, 'get', `/plans/${party.id}`).expect(200)).body);
    expect(after.title).toBe(winner.title);
    expect(after.version).toBe(party.version + 1);
    expect(code((a.status === 409 ? a : b).body)).toBe('conflict');
  });

  it('F: keeps accounts apart — no reads, lists, writes or invitations across accounts', async () => {
    const secret = await hangout(nisreen);
    const stranger = await person('stranger');
    expect((await as(stranger, 'get', '/plans').expect(200)).body).toEqual({ items: [] });
    for (const [method, path] of [
      ['get', `/plans/${secret.id}`],
      ['post', `/plans/${secret.id}/leave`],
      ['delete', `/plans/${secret.id}`],
      ['post', `/plans/${secret.id}/cancel`],
      ['get', `/plans/${secret.id}/invitations`],
      ['post', `/plans/${secret.id}/invitations`],
    ] as const) {
      expect((await as(stranger, method, path).send({})).status).toBe(404);
    }
    await as(stranger, 'patch', `/plans/${secret.id}`).set('If-Match', '1').send({ title: 'x' }).expect(404);
    await as(stranger, 'post', `/plans/${secret.id}/response`).send({ answer: 'accept' }).expect(404);
    const people = (await as(stranger, 'get', '/people').expect(200)).body as { items: { id: string }[] };
    expect(people.items.map((p) => p.id)).toEqual([stranger.profileId]);
  });
});
