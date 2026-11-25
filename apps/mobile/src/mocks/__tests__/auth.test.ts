import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';
import { statusFor } from '@/stores/session';

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('sign-up creates a separate local account', () => {
  it('starts unverified, with the names given and an empty world', async () => {
    const session = await services.auth.signUp('Lina@Example.com', 'secret12', { firstName: 'Lina', lastName: 'Haddad' });
    expect(session.accountId).toMatch(/^acct-/);
    const account = await services.profile.getAccount();
    expect(account).toMatchObject({ firstName: 'Lina', lastName: 'Haddad', email: 'lina@example.com', emailVerified: false });
    expect(statusFor(account)).toBe('verifying');
    expect(await services.plans.listUpcoming()).toEqual([]);
    expect(await services.saved.list()).toEqual([]);
  });

  it('never touches seeded users', async () => {
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'Haddad' });
    await services.saved.save('myazu');
    await services.auth.signIn('ahmad@example.com', 'x');
    const ahmad = await services.profile.getAccount();
    expect(ahmad.firstName).toBe('Ahmad');
    expect(await services.saved.list()).toEqual([]);
  });

  it('rejects an email that is already used', async () => {
    await expect(
      services.auth.signUp('ahmad@example.com', 'secret12', { firstName: 'A', lastName: 'B' }),
    ).rejects.toMatchObject({ code: 'email_taken' });
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    await expect(
      services.auth.signUp('LINA@example.com', 'secret12', { firstName: 'L', lastName: 'H' }),
    ).rejects.toMatchObject({ code: 'email_taken' });
  });

  it('can sign back in to a local account', async () => {
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    await services.auth.signOut();
    await services.auth.signIn('lina@example.com', 'anything');
    expect((await services.profile.getAccount()).firstName).toBe('Lina');
  });

  it('refuses unknown emails instead of falling back to a seeded user', async () => {
    await expect(services.auth.signIn('nobody@example.com', 'x')).rejects.toMatchObject({ code: 'no_account' });
  });
});

describe('verification', () => {
  it('accepts 424242 and moves the account on to onboarding', async () => {
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    await expect(services.auth.verifyEmailCode('111111')).rejects.toMatchObject({ code: 'bad_code' });
    await services.auth.verifyEmailCode('424242');
    expect(statusFor(await services.profile.getAccount())).toBe('onboarding');
  });

  it('Change email drops the unverified account so the email is free again', async () => {
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    await services.auth.abandonSignUp();
    expect(await services.auth.getSession()).toBeNull();
    await expect(
      services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' }),
    ).resolves.toBeTruthy();
  });
});

describe('onboarding', () => {
  it('records the step reached so a relaunch resumes there', async () => {
    await services.auth.signUp('lina@example.com', 'secret12', { firstName: 'Lina', lastName: 'H' });
    await services.auth.verifyEmailCode('424242');
    await services.profile.completeOnboardingStep('profile');
    expect((await services.profile.getAccount()).onboardingStep).toBe('interests');
    await services.profile.setInterests(['Coffee', 'Museums']);
    await services.profile.completeOnboardingStep('interests');
    await services.profile.completeOnboardingStep('location');
    await services.profile.completeOnboardingStep('notifications');
    const account = await services.profile.getAccount();
    expect(account.onboardingComplete).toBe(true);
    expect(account.interests).toEqual(['Coffee', 'Museums']);
    expect(statusFor(account)).toBe('ready');
  });
});

describe('password reset', () => {
  it('enforces the board rule of 8+ characters', async () => {
    await expect(services.auth.setNewPassword('short')).rejects.toMatchObject({ code: 'weak_password' });
    await expect(services.auth.setNewPassword('longenough')).resolves.toBeUndefined();
  });
});
