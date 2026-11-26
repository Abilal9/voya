import { mockServices as services, removePersonFromPlans } from '../services';
import { resetAll, seedWorld, simulation } from '../store';
import { avatarUri } from '@/features/profile/avatar';

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('profile', () => {
  it('edits fields for the signed-in account only', async () => {
    await services.auth.signIn('omar@example.com', 'x');
    await services.profile.updateProfile({ firstName: 'Omar', lastName: 'H.', city: 'Jeddah', bio: 'Padel most weekends.' });
    expect(await services.profile.getAccount()).toMatchObject({ city: 'Jeddah', bio: 'Padel most weekends.' });
    await services.auth.signIn('khaled@example.com', 'x');
    expect((await services.profile.getAccount()).bio).toBeUndefined();
  });

  it('stores an avatar as an app-local reference, replaces and removes it', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    const first = await services.profile.setAvatar('file:///tmp/picked.jpg');
    expect(first.avatarRef).toMatch(/^avatars\/p-ahmad-\d+\.jpg$/);
    expect(avatarUri(first.avatarRef)).toBeDefined();
    const second = await services.profile.setAvatar('file:///tmp/other.png');
    expect(second.avatarRef).not.toBe(first.avatarRef);
    expect(avatarUri(first.avatarRef)).toBeUndefined(); // old file cleaned up
    const cleared = await services.profile.setAvatar(null);
    expect(cleared.avatarRef).toBeUndefined();
    expect(avatarUri(second.avatarRef)).toBeUndefined();
  });

  it('treats a missing avatar file as no avatar', () => {
    expect(avatarUri('avatars/gone.jpg')).toBeUndefined();
    expect(avatarUri(undefined)).toBeUndefined();
  });

  it('keeps interests per account', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    await services.profile.setInterests(['Museums', 'Padel']);
    await services.auth.signIn('khaled@example.com', 'x');
    expect((await services.profile.getAccount()).interests).not.toContain('Museums');
    await services.auth.signIn('ahmad@example.com', 'x');
    expect((await services.profile.getAccount()).interests).toEqual(['Museums', 'Padel']);
  });
});

describe('settings', () => {
  it('starts from the board defaults and persists changes per account', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    const defaults = await services.profile.getSettings();
    expect(defaults.notifications.newSuggestions).toBe(true);
    expect(defaults.notifications.productUpdates).toBe(false);
    expect(defaults.discoveryRadiusKm).toBe(15);
    await services.profile.updateSettings({ notifications: { planChanges: false }, discoveryRadiusKm: 5, preciseLocation: false });
    const after = await services.profile.getSettings();
    expect(after.notifications.planChanges).toBe(false);
    expect(after.notifications.newSuggestions).toBe(true); // untouched keys survive
    expect(after).toMatchObject({ discoveryRadiusKm: 5, preciseLocation: false });
    await services.auth.signIn('khaled@example.com', 'x');
    expect((await services.profile.getSettings()).notifications.planChanges).toBe(true);
  });

  it('reset recommendation preferences forgets likes and skips', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    await services.places.setSignal('myazu', 'dislike');
    expect((await services.places.discover({ city: 'Riyadh' })).map((p) => p.id)).not.toContain('myazu');
    await services.profile.resetRecommendations();
    expect((await services.places.discover({ city: 'Riyadh' })).map((p) => p.id)).toContain('myazu');
  });
});

describe('account deletion', () => {
  it('removes a local account, signs out, and the email cannot sign in again', async () => {
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    await services.saved.save('myazu');
    await services.auth.deleteAccount();
    expect(await services.auth.getSession()).toBeNull();
    await expect(services.auth.signIn('lina@example.com', 'x')).rejects.toMatchObject({ code: 'no_account' });
    // Recreating starts from nothing.
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    expect(await services.saved.list()).toEqual([]);
  });

  it('deleting a seeded member keeps shared plans consistent for everyone else', async () => {
    await services.auth.signIn('khaled@example.com', 'x');
    await services.auth.deleteAccount();
    await expect(services.auth.signIn('khaled@example.com', 'x')).rejects.toMatchObject({ code: 'no_account' });
    await services.auth.signIn('ahmad@example.com', 'x');
    const friday = await services.plans.get('plan-friday');
    if (friday.type !== 'hangout') throw new Error('expected hangout');
    expect(friday.members.map((m) => m.personId)).not.toContain('p-khaled');
    expect(friday.suggestions.every((sg) => !('p-khaled' in sg.votes))).toBe(true);
    expect(friday.suggestions.find((sg) => sg.id === 'sg-2')!.suggestedBy).toBe('former-member');
    const wedding = await services.plans.get('plan-wedding');
    if (wedding.type !== 'event') throw new Error('expected event');
    expect(wedding.guests.map((g) => g.personId)).not.toContain('p-khaled');
  });

  it('hands an owned plan to the next member, or removes it when nobody is left', () => {
    const plans = seedWorld().plans;
    const after = removePersonFromPlans(plans, 'p-ahmad');
    const friday = after.find((p) => p.id === 'plan-friday')!;
    expect(friday.ownerId).toBe('p-khaled');
    expect(friday.members[0]).toMatchObject({ personId: 'p-khaled', role: 'organizer' });
    expect(friday.members[0]!.capabilities).toContain('timeline.finalize');
    const solo = { ...plans[0]!, id: 'solo', ownerId: 'p-ahmad', members: [plans[0]!.members[0]!] };
    expect(removePersonFromPlans([solo], 'p-ahmad')).toEqual([]);
  });

  it('cancelling (not calling delete) keeps everything', async () => {
    await services.auth.signIn('ahmad@example.com', 'x');
    await services.saved.save('roka');
    await services.auth.signOut();
    await services.auth.signIn('ahmad@example.com', 'x');
    expect((await services.saved.list()).map((s) => s.placeId)).toEqual(['roka']);
  });

  it('reset restores deleted seeded accounts', async () => {
    await services.auth.signIn('omar@example.com', 'x');
    await services.auth.deleteAccount();
    await resetAll();
    await expect(services.auth.signIn('omar@example.com', 'x')).resolves.toMatchObject({ accountId: 'p-omar' });
  });
});
