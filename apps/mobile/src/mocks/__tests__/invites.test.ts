import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';
import { INVITE_TOKENS } from '../fixtures';
import { relationTo } from '@/services/planRules';

const as = (who: string) => services.auth.signIn(`${who}@example.com`, 'x');
const me = (who: string) => `p-${who}`;

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('invitation links (development entry point)', () => {
  it('previews only what the invitation says, without access to the plan', async () => {
    await as('nisreen');
    const inv = await services.invitations.resolve(INVITE_TOKENS.validTrip);
    expect(inv).toMatchObject({ planType: 'trip', planTitle: 'Florence', inviterName: 'Ahmad' });
    await expect(services.plans.get('plan-florence')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('opening a trip invitation leads to the trip’s own join screen; joining is still a choice', async () => {
    await as('nisreen');
    const r = await services.invitations.accept(INVITE_TOKENS.validTrip);
    expect(r).toEqual({ planId: 'plan-florence', planType: 'trip', alreadyMember: false });
    const t = await services.plans.get('plan-florence');
    expect(relationTo(t, me('nisreen'))).toBe('invited');
    expect(t.members.map((m) => m.personId)).not.toContain(me('nisreen'));
    // Opening the same link again doesn't replay anything.
    expect(await services.invitations.accept(INVITE_TOKENS.validTrip)).toMatchObject({ alreadyMember: false });
    await services.trips.respond('plan-florence', 'join');
    expect(await services.invitations.accept(INVITE_TOKENS.validTrip)).toMatchObject({ alreadyMember: true });
  });

  it('hangout and event links use the same flow: pending invite, then the plan’s invitation', async () => {
    await as('nisreen');
    expect((await services.invitations.accept(INVITE_TOKENS.validHangout)).planType).toBe('hangout');
    expect(relationTo(await services.plans.get('plan-friday'), me('nisreen'))).toBe('invited');
    await services.hangouts.respond('plan-friday', 'in');
    expect(relationTo(await services.plans.get('plan-friday'), me('nisreen'))).toBe('member');

    await as('faisal');
    expect((await services.invitations.accept(INVITE_TOKENS.validEvent)).alreadyMember).toBe(false); // already a pending guest
    await services.events.respond('plan-wedding', 'going');
    expect((await services.invitations.accept(INVITE_TOKENS.validEvent)).alreadyMember).toBe(true);
  });

  it('a host or existing member is told they are already in', async () => {
    await as('ahmad');
    expect(await services.invitations.accept(INVITE_TOKENS.validTrip)).toMatchObject({ alreadyMember: true });
  });

  it('invalid, expired and revoked links fail without changing anything', async () => {
    await as('nisreen');
    await expect(services.invitations.accept('inv-nope')).rejects.toMatchObject({ code: 'invalid_invite' });
    await expect(services.invitations.accept(INVITE_TOKENS.expired)).rejects.toMatchObject({ code: 'expired' });
    await expect(services.invitations.accept(INVITE_TOKENS.revoked)).rejects.toMatchObject({ code: 'revoked' });
    await expect(services.plans.get('plan-friday')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('someone who declined a trip can reopen the invitation', async () => {
    await as('nisreen');
    await services.invitations.accept(INVITE_TOKENS.validTrip);
    await services.trips.respond('plan-florence', 'decline');
    await expect(services.plans.get('plan-florence')).rejects.toMatchObject({ code: 'not_found' });
    await services.invitations.accept(INVITE_TOKENS.validTrip);
    expect(relationTo(await services.plans.get('plan-florence'), me('nisreen'))).toBe('invited');
  });

  it('a link to a cancelled event is unavailable', async () => {
    await as('ahmad');
    await services.events.cancel('plan-wedding');
    await as('nisreen');
    await expect(services.invitations.accept(INVITE_TOKENS.validEvent)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('simulated offline', () => {
  it('fails with an offline error and keeps saved data', async () => {
    await as('ahmad');
    const before = await services.plans.listUpcoming();
    simulation.offline = true;
    try {
      await expect(services.plans.listUpcoming()).rejects.toMatchObject({ code: 'offline', retryable: true });
    } finally {
      simulation.offline = false;
    }
    expect((await services.plans.listUpcoming()).map((p) => p.id)).toEqual(before.map((p) => p.id));
  });
});

describe('activity (38)', () => {
  it('is per account and hides plans the person can no longer see', async () => {
    await as('ahmad');
    const before = (await services.notifications.list()).map((a) => a.planId);
    expect(before).toContain('plan-wedding');
    await services.plans.leave('plan-florence');
    expect((await services.notifications.list()).map((a) => a.planId)).not.toContain('plan-florence');
    await as('nisreen');
    expect((await services.notifications.list()).every((a) => a.planId !== 'plan-friday')).toBe(true);
  });
});
