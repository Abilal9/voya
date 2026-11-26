import { sha256Hex } from '../sha256';

// A fake development account stands in for the real one, so no real
// password ever appears in the repository. Same mechanism, test-only values.
const FAKE_PASSWORD = 'fake-dev-password';
jest.mock('../devAccounts', () => {
  const { sha256Hex: hash } = jest.requireActual('../sha256');
  const entry = {
    email: 'dev.tester@example.test',
    passwordSha256: hash('fake-dev-password'),
    account: {
      id: 'dev-test', personId: 'p-ahmad', firstName: 'Dev', lastName: 'Tester',
      displayName: 'Dev Tester', city: 'Riyadh', email: 'dev.tester@example.test',
      emailVerified: true, onboardingStep: 'profile', onboardingComplete: false, interests: [],
    },
  };
  return {
    DEV_ACCOUNTS: [entry],
    devAccountFor: (email: string) => (email.trim().toLowerCase() === entry.email ? entry : undefined),
  };
});

// eslint-disable-next-line import/first -- the mock above must be registered first
import { mockServices as services } from '../services';
// eslint-disable-next-line import/first
import { resetAll, simulation } from '../store';
// eslint-disable-next-line import/first
import { statusFor } from '@/stores/session';

const EMAIL = 'dev.tester@example.test';

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('sha256', () => {
  it('matches known digests', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('development test account', () => {
  it('signs in only with the right password and starts at onboarding', async () => {
    await expect(services.auth.signIn(EMAIL, 'wrong')).rejects.toMatchObject({ code: 'bad_credentials' });
    expect((await services.auth.signIn(EMAIL, FAKE_PASSWORD)).accountId).toBe('dev-test');
    const account = await services.profile.getAccount();
    expect(account.displayName).toBe('Dev Tester');
    expect(statusFor(account)).toBe('onboarding');
  });

  it('sees the seeded plans through its plan identity, headcounts unchanged', async () => {
    await services.auth.signIn(EMAIL, FAKE_PASSWORD);
    const titles = (await services.plans.listUpcoming()).map((p) => p.title);
    expect(titles).toEqual(['Friday Night', "Ahmad & Nisreen's Wedding", 'Florence']);
  });

  it('keeps its own profile, saves and onboarding step across logout', async () => {
    await services.auth.signIn(EMAIL, FAKE_PASSWORD);
    await services.profile.completeOnboardingStep('profile');
    await services.saved.save('myazu');
    await services.auth.signOut();
    await services.auth.signIn('ahmad@example.com', 'x');
    expect(await services.saved.list()).toEqual([]);
    expect((await services.profile.getAccount()).displayName).toBe('Ahmad Bilal');
    await services.auth.signIn(EMAIL, FAKE_PASSWORD);
    expect((await services.saved.list()).map((s) => s.placeId)).toEqual(['myazu']);
    expect((await services.profile.getAccount()).onboardingStep).toBe('interests');
  });

  it('cannot be claimed by sign-up', async () => {
    await expect(
      services.auth.signUp(EMAIL, 'whatever1', { firstName: 'X', lastName: 'Y' }),
    ).rejects.toMatchObject({ code: 'email_taken' });
  });
});
