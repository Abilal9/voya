import { localAccountBridge } from '@/mocks/localAccount';
import { mockServices } from '@/mocks/services';
import { resetAll, simulation } from '@/mocks/store';
import { statusFor } from '@/stores/session';
import { ServiceError } from '@/services/types';
import { authError, contentTypeOf, createRealAccountServices, localIdFor, urlParams } from '../account';
import { fakeApi, fakeSupabase, memoryKv, type FakeSupabase } from './fakes';

/**
 * The real account provider against in-memory Supabase Auth and API doubles.
 * The still-mocked services (plans, saves) run for real on the mock store, so
 * these tests also prove a real account gets its own, empty mock namespace.
 */

let sb: FakeSupabase;
let api: ReturnType<typeof fakeApi>;
let kv: ReturnType<typeof memoryKv>;
let uploads: { uri: string; url: string; type: string }[];
let uploadStatus: number | Error;
let cleared: number;

function build() {
  return createRealAccountServices({
    supabase: sb.client,
    apiUrl: 'http://api.test',
    supabaseUrl: 'http://192.168.1.20:54321',
    bridge: localAccountBridge,
    kv,
    recoveryRedirect: () => 'exp://192.168.1.20:8081/--/set-password',
    uploadFile: async (uri, url, type) => {
      uploads.push({ uri, url, type });
      if (uploadStatus instanceof Error) throw uploadStatus;
      return uploadStatus;
    },
    clearStoredSession: async () => {
      cleared += 1;
      sb.clearStored();
    },
    fetch: api.fetch,
  });
}

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (e) {
    return e instanceof ServiceError ? e.code : `not a ServiceError: ${String(e)}`;
  }
  return 'resolved';
};

beforeEach(async () => {
  simulation.latencyMs = 0;
  simulation.offline = false;
  await resetAll();
  sb = fakeSupabase();
  api = fakeApi(sb);
  kv = memoryKv();
  uploads = [];
  uploadStatus = 200;
  cleared = 0;
});

describe('sign-up and email verification (A02 → A06)', () => {
  it('waits for the emailed code, then provisions the profile with the sign-up names', async () => {
    const { auth, profile } = build();
    const pending = await auth.signUp(' Reem@Example.com ', 'secret12', { firstName: 'Reem', lastName: 'Fahad' });
    expect(pending.email).toBe('reem@example.com');
    expect(sb.stored).toBeNull();

    // Before verification: the A06 state, no session, nothing from the API.
    const unverified = await profile.getAccount();
    expect(statusFor(unverified)).toBe('verifying');
    expect(unverified).toMatchObject({ email: 'reem@example.com', firstName: 'Reem', emailVerified: false });
    expect(api.requests).toHaveLength(0);

    expect(await code(auth.verifyEmailCode('000000'))).toBe('bad_code');
    await auth.verifyEmailCode('135790');
    const account = await profile.getAccount();
    expect(account).toMatchObject({ firstName: 'Reem', lastName: 'Fahad', emailVerified: true, onboardingStep: 'profile' });
    expect(statusFor(account)).toBe('onboarding');
    expect(account.personId).toBe(localIdFor(sb.users.get('reem@example.com')!.id));
  });

  it('survives a restart between sign-up and verification', async () => {
    await build().auth.signUp('lama@example.com', 'secret12', { firstName: 'Lama', lastName: 'S' });
    const again = build();
    expect(await again.auth.getSession()).toMatchObject({ email: 'lama@example.com' });
    expect((await again.profile.getAccount()).emailVerified).toBe(false);
  });

  it('resends a code, and Change email forgets the pending sign-up', async () => {
    const { auth } = build();
    await auth.signUp('a@example.com', 'secret12', { firstName: 'A', lastName: 'B' });
    await auth.resendVerificationCode();
    expect(sb.calls).toContain('resend');
    expect(await code(auth.verifyEmailCode('135790'))).toBe('bad_code'); // the old code was replaced
    await auth.abandonSignUp();
    expect(await auth.getSession()).toBeNull();
  });

  it('reports an email that already has an account', async () => {
    sb.addUser('taken@example.com', 'secret12');
    expect(await code(build().auth.signUp('taken@example.com', 'other123', { firstName: 'T', lastName: 'K' }))).toBe('email_taken');
  });

  it('gives no fake mock hint: the real provider has no fixed code', () => {
    expect(build().auth.verificationCodeHint).toBeUndefined();
    expect(mockServices.auth.verificationCodeHint).toBe('424242');
  });
});

describe('sign-in', () => {
  it('signs in, links its own empty namespace for the mock services, and never a seeded identity', async () => {
    sb.addUser('omar.real@example.com', 'secret12', { first_name: 'Omar' });
    const { auth, profile } = build();
    const session = await auth.signIn('Omar.Real@example.com', 'secret12');
    const account = await profile.getAccount();
    expect(session.accountId).toBe(account.personId);
    expect(account.firstName).toBe('Omar');
    expect(await mockServices.plans.listUpcoming()).toEqual([]);
    expect(await mockServices.saved.list()).toEqual([]);
  });

  it('rejects wrong credentials without touching the mock accounts', async () => {
    sb.addUser('x@example.com', 'secret12');
    const { auth } = build();
    expect(await code(auth.signIn('x@example.com', 'nope1234'))).toBe('bad_credentials');
    // A seeded mock email is not an account in real mode.
    expect(await code(auth.signIn('ahmad@example.com', 'x'))).toBe('bad_credentials');
    expect(await auth.getSession()).toBeNull();
  });

  it('sends an unverified account to Verify with a fresh code', async () => {
    const { auth, profile } = build();
    await auth.signUp('late@example.com', 'secret12', { firstName: 'Late', lastName: 'V' });
    await auth.abandonSignUp();
    await auth.signIn('late@example.com', 'secret12');
    expect(sb.calls.filter((c) => c === 'resend')).toHaveLength(1);
    expect(statusFor(await profile.getAccount())).toBe('verifying');
    await auth.verifyEmailCode('246802');
    expect(statusFor(await profile.getAccount())).toBe('onboarding');
  });

  it('says offline when Supabase cannot be reached', async () => {
    sb.addUser('x@example.com', 'secret12');
    sb.setOffline(true);
    expect(await code(build().auth.signIn('x@example.com', 'secret12'))).toBe('offline');
  });

  it('refuses Apple and Google instead of faking a session', async () => {
    const { auth } = build();
    expect(await code(auth.signInWithApple())).toBe('unavailable');
    expect(await code(auth.signInWithGoogle())).toBe('unavailable');
    expect(sb.stored).toBeNull();
  });
});

describe('sessions', () => {
  it('restores the session after a restart', async () => {
    sb.addUser('r@example.com', 'secret12', { first_name: 'Rana' });
    await build().auth.signIn('r@example.com', 'secret12');
    const restarted = build();
    const session = await restarted.auth.getSession();
    expect(session?.email).toBe('r@example.com');
    expect((await restarted.profile.getAccount()).firstName).toBe('Rana');
  });

  it('ends the session when the API says 401, and tells the app', async () => {
    sb.addUser('e@example.com', 'secret12');
    const { auth, profile } = build();
    const ended = jest.fn();
    auth.onSessionEnded(ended);
    await auth.signIn('e@example.com', 'secret12');
    await profile.getAccount();
    sb.liveTokens.clear(); // revoked server-side
    expect(await code(profile.getAccount())).toBe('unauthenticated');
    expect(ended).toHaveBeenCalledTimes(1);
    expect(await auth.getSession()).toBeNull();
    expect(await code(mockServices.saved.list())).toBe('unauthenticated'); // mock services lost the identity too
  });

  it('ends the session when Supabase drops it (refresh failed or revoked)', async () => {
    sb.addUser('e@example.com', 'secret12');
    const { auth } = build();
    const ended = jest.fn();
    auth.onSessionEnded(ended);
    await auth.signIn('e@example.com', 'secret12');
    sb.revokeFromServer();
    await new Promise((r) => setTimeout(r, 0));
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('signs out completely, even offline', async () => {
    sb.addUser('o@example.com', 'secret12');
    const { auth } = build();
    await auth.signIn('o@example.com', 'secret12');
    sb.setOffline(true);
    await auth.signOut();
    expect(cleared).toBe(1);
    expect(sb.stored).toBeNull();
    expect(await auth.getSession()).toBeNull();
    expect(await code(mockServices.saved.list())).toBe('unauthenticated');
  });

  it('keeps two accounts on one phone apart', async () => {
    sb.addUser('a@example.com', 'secret12', { first_name: 'Asma' });
    sb.addUser('b@example.com', 'secret12', { first_name: 'Bader' });
    const { auth, profile } = build();
    await auth.signIn('a@example.com', 'secret12');
    await profile.getAccount();
    await mockServices.saved.save('myazu');
    await profile.updateSettings({ mutedPlans: ['plan-x'] });
    await auth.signOut();

    await auth.signIn('b@example.com', 'secret12');
    expect((await profile.getAccount()).firstName).toBe('Bader');
    expect(await mockServices.saved.list()).toEqual([]);
    expect((await profile.getSettings()).mutedPlans).toEqual([]);
  });

  it('opens offline with the copy already on this phone, but never with someone else\'s', async () => {
    sb.addUser('c@example.com', 'secret12', { first_name: 'Cyra' });
    const first = build();
    await first.auth.signIn('c@example.com', 'secret12');
    await first.profile.getAccount();
    api.setDown(true);
    const restarted = build();
    await restarted.auth.getSession();
    expect((await restarted.profile.getAccount()).firstName).toBe('Cyra');

    sb.addUser('d@example.com', 'secret12');
    await restarted.auth.signOut();
    sb.setOffline(false);
    await restarted.auth.signIn('d@example.com', 'secret12');
    expect(await code(restarted.profile.getAccount())).toBe('offline');
  });
});

describe('password reset (A04 → A05 → A11 → A12)', () => {
  it('sends the link back to the app, sets the new password from it, then asks to sign in', async () => {
    sb.addUser('p@example.com', 'old-pass-1');
    const { auth } = build();
    await auth.requestPasswordReset(' P@example.com ');
    expect(sb.calls).toContain('reset:exp://192.168.1.20:8081/--/set-password');

    const id = sb.users.get('p@example.com')!.id;
    await auth.handleUrl(`exp://192.168.1.20:8081/--/set-password?code=code-${id}`);
    expect(await auth.getSession()).toBeNull(); // a recovery session is not an app session

    await auth.setNewPassword('new-pass-12');
    expect(sb.stored).toBeNull();
    expect(await code(auth.signIn('p@example.com', 'old-pass-1'))).toBe('bad_credentials');
    await auth.signIn('p@example.com', 'new-pass-12');
  });

  it('explains an expired or reused link instead of failing silently', async () => {
    const { auth } = build();
    await auth.handleUrl('voya://set-password?error=access_denied&error_code=otp_expired');
    await expect(auth.setNewPassword('new-pass-12')).rejects.toThrow(/expired or was already used/);
    await auth.handleUrl('voya://set-password?code=unknown');
    await expect(auth.setNewPassword('new-pass-12')).rejects.toThrow(/expired or was already used/);
  });

  it('needs the link: without it no password is changed', async () => {
    expect(await code(build().auth.setNewPassword('new-pass-12'))).toBe('unauthenticated');
  });

  it('changes the password of a signed-in account and keeps it signed in (Settings → Password)', async () => {
    sb.addUser('s@example.com', 'secret12');
    const { auth } = build();
    await auth.signIn('s@example.com', 'secret12');
    await auth.setNewPassword('another-9');
    expect(await auth.getSession()).not.toBeNull();
    expect(await code(auth.setNewPassword('another-9'))).toBe('same_password');
    expect(await code(auth.setNewPassword('short'))).toBe('weak_password');
  });

  it('says so when the reset email could not be requested', async () => {
    sb.setOffline(true);
    expect(await code(build().auth.requestPasswordReset('p@example.com'))).toBe('offline');
  });
});

describe('profile, interests, onboarding and settings', () => {
  async function signedIn() {
    sb.addUser('m@example.com', 'secret12', { first_name: 'Maha' });
    const s = build();
    await s.auth.signIn('m@example.com', 'secret12');
    return s;
  }

  it('sends cleared optional fields as null and returns the saved profile', async () => {
    const { profile } = await signedIn();
    await profile.updateProfile({ firstName: 'Maha', city: 'Jeddah', bio: 'Hi' });
    const account = await profile.updateProfile({ firstName: 'Maha', lastName: undefined, city: undefined, bio: undefined });
    expect(api.requests.at(-1)?.body).toEqual({ firstName: 'Maha', lastName: null, city: null, bio: null });
    expect(account.city).toBeUndefined();
  });

  it('shows the server\'s validation message, never a raw body', async () => {
    const { profile } = await signedIn();
    await expect(profile.updateProfile({ id: 'x' } as never)).rejects.toThrow('Some of the details are not valid.');
  });

  it('saves interests and moves onboarding forward', async () => {
    const { profile } = await signedIn();
    expect((await profile.setInterests(['Coffee'])).interests).toEqual(['Coffee']);
    expect((await profile.completeOnboardingStep('profile')).onboardingStep).toBe('interests');
    expect((await profile.completeOnboardingStep('notifications')).onboardingComplete).toBe(true);
  });

  it('keeps account preferences on the server and per-plan mutes on the phone', async () => {
    const { profile } = await signedIn();
    const s = await profile.updateSettings({ notifications: { planChanges: false }, mutedPlans: ['p1'] });
    expect(s.notifications.planChanges).toBe(false);
    expect(s.mutedPlans).toEqual(['p1']);
    expect(api.requests.at(-1)?.body).toEqual({ notifications: { planChanges: false } });
    expect(await profile.getSettings()).toMatchObject({ discoveryRadiusKm: 15, mutedPlans: ['p1'] });
  });

  it('does not claim a save that failed', async () => {
    const { profile } = await signedIn();
    api.setDown(true);
    expect(await code(profile.updateProfile({ city: 'Dubai' }))).toBe('offline');
    expect(await code(profile.updateSettings({ preciseLocation: false }))).toBe('offline');
  });
});

describe('profile photo', () => {
  async function signedIn() {
    sb.addUser('f@example.com', 'secret12');
    const s = build();
    await s.auth.signIn('f@example.com', 'secret12');
    return s;
  }

  it('uploads to the signed URL on the device-reachable host, commits, and shows the signed photo URL', async () => {
    const { profile } = await signedIn();
    const account = await profile.setAvatar('file:///picked/photo.JPG');
    expect(uploads[0]).toMatchObject({ uri: 'file:///picked/photo.JPG', type: 'image/jpeg' });
    expect(uploads[0]!.url.startsWith('http://192.168.1.20:54321/storage/v1/object/upload/sign/avatars/')).toBe(true);
    expect(account.avatarRef?.startsWith('http://192.168.1.20:54321/storage/v1/object/sign/avatars/')).toBe(true);
    expect((await profile.setAvatar(null)).avatarRef).toBeUndefined();
  });

  it('handles unsupported, oversize, failed and offline uploads without changing the photo', async () => {
    const { profile } = await signedIn();
    expect(await code(profile.setAvatar('file:///x/anim.gif'))).toBe('unsupported_photo');
    uploadStatus = 413;
    expect(await code(profile.setAvatar('file:///x/big.png'))).toBe('photo_too_large');
    uploadStatus = 500;
    expect(await code(profile.setAvatar('file:///x/a.png'))).toBe('upload_failed');
    uploadStatus = new Error('network');
    expect(await code(profile.setAvatar('file:///x/a.png'))).toBe('offline');
    expect(api.requests.some((r) => r.method === 'PUT' && r.path === '/me/avatar')).toBe(false);
    expect((await profile.getAccount()).avatarRef).toBeUndefined();
  });
});

describe('account deletion (V10)', () => {
  it('deletes on the server, forgets local data and signs out', async () => {
    sb.addUser('del@example.com', 'secret12');
    const { auth, profile } = build();
    await auth.signIn('del@example.com', 'secret12');
    await profile.getAccount();
    await mockServices.saved.save('myazu');
    await auth.deleteAccount();
    expect(api.requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/me' });
    expect(await auth.getSession()).toBeNull();
    expect(await code(auth.signIn('del@example.com', 'secret12'))).toBe('bad_credentials');
  });

  it('keeps everything when the server refuses or cannot be reached', async () => {
    sb.addUser('keep@example.com', 'secret12');
    const { auth } = build();
    await auth.signIn('keep@example.com', 'secret12');
    api.setDown(true);
    expect(await code(auth.deleteAccount())).toBe('offline');
    expect(await auth.getSession()).not.toBeNull();
  });
});

describe('helpers', () => {
  it('maps Supabase errors to safe messages', () => {
    expect(authError({ name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'x' } as never).message).toBe(
      'That email and password do not match.',
    );
    expect(authError({ name: 'AuthRetryableFetchError', status: 0, message: 'x' } as never).code).toBe('offline');
    expect(authError({ name: 'AuthApiError', status: 429, message: 'x' } as never).code).toBe('rate_limited');
    expect(authError({ name: 'AuthApiError', code: 'mystery', status: 500, message: 'internal detail' } as never).message).toBe(
      'Something went wrong. Try again.',
    );
  });

  it('reads deep links from any scheme', () => {
    expect(urlParams('exp://10.0.0.2:8081/--/set-password?code=abc')).toEqual({ path: '10.0.0.2:8081/--/set-password', values: { code: 'abc' } });
    expect(urlParams('voya://set-password#error=access_denied')).toEqual({ path: 'set-password', values: { error: 'access_denied' } });
    expect(urlParams('voya://invite/abc')?.path.endsWith('set-password')).toBe(false);
  });

  it('knows the photo types the bucket takes', () => {
    expect(contentTypeOf('file:///a.HEIC')).toBe('image/heic');
    expect(contentTypeOf('file:///a.jpeg?x=1')).toBe('image/jpeg');
    expect(contentTypeOf('file:///a')).toBeUndefined();
  });
});
