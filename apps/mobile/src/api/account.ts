import {
  AccountPreferencesSchema,
  AvatarUploadSchema,
  MeResponseSchema,
  type AccountPreferences,
  type MeResponse,
} from '@voya/contracts';
import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import type { LocalAccountBridge } from '@/mocks/localAccount';
import type { AuthService, AuthSession, ProfileService } from '@/services/contracts';
import { ServiceError, type Account, type AccountSettings } from '@/services/types';
import { OFFLINE, createApiClient, type ApiClient } from './http';

/**
 * The real account provider (B1): Supabase Auth for credentials and
 * sessions, the Voya API for the profile and preferences. It implements the
 * same AuthService/ProfileService contracts as the mocks, so no screen knows
 * which one it is talking to.
 *
 * Rules it keeps:
 * - It never falls back to mock credentials or seeded people. Without a
 *   Supabase session there is no account.
 * - The still-mocked services (plans, saves, activity) act as this account
 *   only, in a namespace derived from the auth user id (`sb-<uuid>`), linked
 *   through the LocalAccountBridge, and unlinked on sign-out.
 * - A session that ends anywhere (sign-out, refresh failure, a 401 from the
 *   API, account deletion) clears the stored tokens and tells the app.
 */

/** What the sign-up → verify step remembers between screens and restarts (no password). */
export interface PendingSignUp {
  email: string;
  firstName?: string;
  lastName?: string;
}

/** Small key-value store for non-token state (SecureStore in the app, a Map in tests). */
export interface KeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface RealAccountDeps {
  supabase: Pick<SupabaseClient, 'auth'>;
  apiUrl: string;
  /** Public Supabase URL as THIS device reaches it; signed storage URLs are pointed at it. */
  supabaseUrl: string;
  bridge: LocalAccountBridge;
  kv: KeyValue;
  /** Where the password-reset link returns (`voya://set-password`, or Expo Go's `exp://…/--/set-password`). */
  recoveryRedirect: () => string;
  /** PUTs the picked file to a signed URL; resolves with the HTTP status. */
  uploadFile: (localUri: string, url: string, contentType: string) => Promise<number>;
  /** Removes stored tokens without the network (offline sign-out). */
  clearStoredSession: () => Promise<void>;
  fetch?: typeof fetch;
  now?: () => number;
}

const PENDING_KEY = 'voya.pending-signup';
const RECOVERY_KEY = 'voya.recovery';
/** A recovery left unfinished this long is abandoned (its session is signed out). */
const RECOVERY_TTL_MS = 60 * 60 * 1000;
const PENDING_ACCOUNT_ID = 'pending-signup';

export const localIdFor = (authUserId: string) => `sb-${authUserId}`;

export function createRealAccountServices(deps: RealAccountDeps) {
  const { supabase, bridge, kv } = deps;
  const now = deps.now ?? Date.now;
  const listeners = new Set<() => void>();
  let current: { localId: string; email: string } | null = null;
  let exchanging: Promise<void> | null = null;
  let recoveryError: string | undefined;
  let endingSession = false;

  const api: ApiClient = createApiClient({
    baseUrl: deps.apiUrl,
    fetch: deps.fetch,
    accessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
    onUnauthenticated: () => endSession(),
  });

  // ------------------------------------------------------------- state

  async function pending(): Promise<PendingSignUp | null> {
    const raw = await kv.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSignUp) : null;
  }
  const setPending = (value: PendingSignUp | null) =>
    value ? kv.setItem(PENDING_KEY, JSON.stringify(value)) : kv.removeItem(PENDING_KEY);

  async function recoveryStartedAt(): Promise<number | null> {
    const raw = await kv.getItem(RECOVERY_KEY);
    return raw ? Number(raw) : null;
  }
  const setRecovery = (startedAt: number | null) =>
    startedAt === null ? kv.removeItem(RECOVERY_KEY) : kv.setItem(RECOVERY_KEY, String(startedAt));

  /** Supabase session → the account the mock services act as (its own namespace). */
  async function establish(session: Session): Promise<AuthSession> {
    const localId = localIdFor(session.user.id);
    const email = session.user.email ?? '';
    current = { localId, email };
    const cached = await bridge.cached(localId);
    await bridge.link(localId, cached ?? placeholderAccount(localId, session));
    return { accountId: localId, email };
  }

  /** Clears tokens, pending state and the local link; tells the app. Idempotent. */
  async function endSession(): Promise<void> {
    if (endingSession) return;
    endingSession = true;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) await deps.clearStoredSession();
    } catch {
      await deps.clearStoredSession();
    }
    try {
      const wasSignedIn = current !== null;
      current = null;
      await setPending(null);
      await setRecovery(null);
      await bridge.unlink();
      if (wasSignedIn) listeners.forEach((l) => l());
    } finally {
      endingSession = false;
    }
  }

  supabase.auth.onAuthStateChange((event) => {
    // Supabase ended the session itself (refresh token revoked or expired).
    if (event === 'SIGNED_OUT' && current && !endingSession) void endSession();
  });

  async function requireSignedIn(): Promise<{ localId: string; email: string }> {
    if (current) return current;
    const session = await auth.getSession();
    if (!session || session.accountId === PENDING_ACCOUNT_ID || !current) {
      throw new ServiceError('unauthenticated', 'Sign in to continue.', false);
    }
    return current;
  }

  /** Signed storage URLs carry the API's view of Supabase's host; point them at the one this device reaches. */
  function deviceUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      if (!parsed.pathname.startsWith('/storage/v1/')) return url;
      const device = new URL(deps.supabaseUrl);
      return `${device.origin}${parsed.pathname}${parsed.search}`;
    } catch {
      return undefined;
    }
  }

  function toAccount(me: MeResponse, who: { localId: string; email: string }): Account {
    const p = me.profile;
    return {
      id: p.id,
      personId: who.localId,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName,
      city: p.city,
      bio: p.bio,
      email: me.auth.email ?? who.email,
      emailVerified: true,
      onboardingStep: p.onboardingStep,
      onboardingComplete: p.onboardingComplete,
      interests: p.interests,
      avatarRef: deviceUrl(p.avatarUrl),
    };
  }

  /** Every profile change returns the profile; keep the offline copy in step. */
  async function accountFrom(call: Promise<MeResponse>): Promise<Account> {
    const who = await requireSignedIn();
    const account = toAccount(await call, who);
    await bridge.link(who.localId, account);
    return account;
  }

  // -------------------------------------------------------------- auth

  const auth: AuthService & {
    onSessionEnded(listener: () => void): () => void;
    handleUrl(url: string): Promise<void>;
  } = {
    verificationCodeHint: undefined,

    onSessionEnded(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async getSession() {
      const started = await recoveryStartedAt();
      if (started !== null) {
        // A password reset is in progress: its session is not an app session.
        if (now() - started < RECOVERY_TTL_MS) return null;
        await endSession();
        return null;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) return establish(data.session);
      current = null;
      const waiting = await pending();
      return waiting ? { accountId: PENDING_ACCOUNT_ID, email: waiting.email } : null;
    },

    async signIn(email, password) {
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (error) {
        if (error.code === 'email_not_confirmed') {
          // Right password, unverified email: continue at Verify (A06) with a fresh code.
          await setPending({ email: normalized });
          await supabase.auth.resend({ type: 'signup', email: normalized }).catch(() => undefined);
          return { accountId: PENDING_ACCOUNT_ID, email: normalized };
        }
        throw authError(error);
      }
      await setPending(null);
      return establish(data.session);
    },

    async signUp(email, password, names) {
      const normalized = email.trim().toLowerCase();
      const firstName = names.firstName.trim();
      const lastName = names.lastName.trim();
      const { data, error } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (error) throw authError(error);
      // Supabase answers a sign-up for an already-registered email with an identity-less user.
      if (data.user && data.user.identities?.length === 0) {
        throw new ServiceError('email_taken', 'An account already uses that email.', false);
      }
      if (data.session) {
        await setPending(null);
        return establish(data.session);
      }
      await setPending({ email: normalized, firstName, lastName });
      return { accountId: PENDING_ACCOUNT_ID, email: normalized };
    },

    async verifyEmailCode(code) {
      const waiting = await pending();
      if (!waiting) throw new ServiceError('unauthenticated', 'Start again from Create account.', false);
      const { data, error } = await supabase.auth.verifyOtp({ email: waiting.email, token: code, type: 'email' });
      if (error || !data.session) throw error ? authError(error) : new ServiceError('bad_code', 'That code is not correct.', true);
      await setPending(null);
      await establish(data.session);
    },

    async resendVerificationCode() {
      const waiting = await pending();
      if (!waiting) throw new ServiceError('unauthenticated', 'Start again from Create account.', false);
      const { error } = await supabase.auth.resend({ type: 'signup', email: waiting.email });
      if (error) throw authError(error);
    },

    async abandonSignUp() {
      // The unverified Supabase user stays until it is verified or cleaned up; signing up again re-sends a code.
      await setPending(null);
    },

    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: deps.recoveryRedirect(),
      });
      if (error) throw authError(error);
    },

    async setNewPassword(password) {
      if (password.length < 8) throw new ServiceError('weak_password', 'Use at least 8 characters.', false);
      if (exchanging) await exchanging;
      const inRecovery = (await recoveryStartedAt()) !== null;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new ServiceError(
          'unauthenticated',
          recoveryError ?? 'Open the reset link from your email on this phone to set a new password.',
          false,
        );
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw authError(error);
      if (inRecovery) {
        // Reset done: the recovery session ends; the person signs in with the new password (A12).
        await endSession();
      }
    },

    async signInWithApple() {
      throw new ServiceError('unavailable', 'Sign in with Apple is not available yet. Use your email instead.', false);
    },

    async signInWithGoogle() {
      throw new ServiceError('unavailable', 'Sign in with Google is not available yet. Use your email instead.', false);
    },

    async signOut() {
      await endSession();
    },

    async deleteAccount() {
      const who = await requireSignedIn();
      await api.call('DELETE', '/me', null);
      await bridge.forget(who.localId).catch(() => undefined);
      await endSession();
    },

    /** Password-reset links come back as `…/set-password?code=…` (PKCE). */
    async handleUrl(url) {
      const params = urlParams(url);
      if (!params || !params.path.endsWith('set-password')) return;
      if (params.values.error || params.values.error_code) {
        recoveryError = 'That reset link has expired or was already used. Ask for a new one.';
        return;
      }
      const code = params.values.code;
      if (!code) return;
      recoveryError = undefined;
      exchanging = (async () => {
        // Never let a reset link swap the account underneath a signed-in session.
        if (current) await endSession();
        await setRecovery(now());
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          await setRecovery(null);
          recoveryError = 'That reset link has expired or was already used. Ask for a new one.';
        }
      })().finally(() => {
        exchanging = null;
      });
      await exchanging;
    },
  };

  // ----------------------------------------------------------- profile

  const profile: ProfileService = {
    async getAccount() {
      const waiting = current ? null : await pending();
      if (waiting && !(await supabase.auth.getSession()).data.session) return pendingAccount(waiting);
      const who = await requireSignedIn();
      try {
        return await accountFrom(api.call('GET', '/me', MeResponseSchema));
      } catch (e) {
        // Offline cold start: the copy already on this phone (this account's own).
        if (e instanceof ServiceError && (e.code === 'offline' || e.code === 'unavailable')) {
          const cached = await bridge.cached(who.localId);
          if (cached && cached.id !== who.localId) return cached;
        }
        throw e;
      }
    },

    updateProfile(patch) {
      const body: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(patch)) {
        // The app clears optional fields by setting them undefined; JSON needs an explicit null.
        body[k] = v === undefined || v === '' ? null : v;
      }
      return accountFrom(api.call('PATCH', '/me', MeResponseSchema, body));
    },

    setInterests(interests) {
      return accountFrom(api.call('PUT', '/me/interests', MeResponseSchema, { interests }));
    },

    completeOnboardingStep(step) {
      return accountFrom(api.call('POST', '/me/onboarding', MeResponseSchema, { step }));
    },

    async setAvatar(localUri) {
      if (localUri === null) return accountFrom(api.call('DELETE', '/me/avatar', MeResponseSchema));
      const contentType = contentTypeOf(localUri);
      if (!contentType) {
        throw new ServiceError('unsupported_photo', 'That photo type is not supported. Choose a JPEG or PNG photo.', false);
      }
      const slot = await api.call('POST', '/me/avatar/uploads', AvatarUploadSchema, { contentType });
      let status: number;
      try {
        status = await deps.uploadFile(localUri, deviceUrl(slot.uploadUrl) ?? slot.uploadUrl, contentType);
      } catch {
        throw OFFLINE();
      }
      if (status === 413) throw new ServiceError('photo_too_large', 'That photo is too large. Choose one under 5 MB.', false);
      if (status < 200 || status >= 300) {
        throw new ServiceError('upload_failed', 'Your photo could not be uploaded. Try again.', true);
      }
      return accountFrom(api.call('PUT', '/me/avatar', MeResponseSchema, { path: slot.path }));
    },

    async getSettings() {
      const prefs = await api.call('GET', '/me/settings', AccountPreferencesSchema);
      return withMutes(prefs, await bridge.mutedPlans());
    },

    async updateSettings(patch) {
      const { mutedPlans, ...server } = patch;
      const prefs = Object.keys(server).length
        ? await api.call('PATCH', '/me/settings', AccountPreferencesSchema, server)
        : await api.call('GET', '/me/settings', AccountPreferencesSchema);
      const mutes = mutedPlans ? await bridge.setMutedPlans(mutedPlans) : await bridge.mutedPlans();
      return withMutes(prefs, mutes);
    },

    resetRecommendations() {
      return bridge.resetRecommendations();
    },
  };

  return { auth, profile };
}

function withMutes(prefs: AccountPreferences, mutedPlans: string[]): AccountSettings {
  return { ...prefs, mutedPlans };
}

/** The A06 state before the email is verified: no session, no profile yet. */
function pendingAccount(p: PendingSignUp): Account {
  const firstName = p.firstName ?? '';
  return {
    id: PENDING_ACCOUNT_ID,
    firstName,
    lastName: p.lastName,
    displayName: [firstName, p.lastName].filter(Boolean).join(' '),
    email: p.email,
    emailVerified: false,
    onboardingStep: 'profile',
    onboardingComplete: false,
    interests: [],
  };
}

/** Until the first /me answers: enough for the mock services to act as this person. */
function placeholderAccount(localId: string, session: Session): Account {
  const meta = session.user.user_metadata ?? {};
  const firstName = typeof meta.first_name === 'string' ? meta.first_name : '';
  const lastName = typeof meta.last_name === 'string' ? meta.last_name : undefined;
  return {
    id: localId,
    personId: localId,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    email: session.user.email ?? '',
    emailVerified: true,
    onboardingStep: 'profile',
    onboardingComplete: false,
    interests: [],
  };
}

export function contentTypeOf(uri: string): string | undefined {
  const ext = uri.split('?')[0]!.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return undefined;
  }
}

/**
 * Where a deep link points (everything after `scheme://`, so `voya://set-password`
 * and `exp://host:8081/--/set-password` both end in `set-password`) and its
 * query/fragment values.
 */
export function urlParams(url: string): { path: string; values: Record<string, string> } | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i.exec(url);
  if (!match) return null;
  const values: Record<string, string> = {};
  for (const part of [match[2], match[3]]) {
    if (!part) continue;
    for (const pair of part.split('&')) {
      const [k, v = ''] = pair.split('=');
      if (k) values[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return { path: (match[1] ?? '').replace(/\/$/, ''), values };
}

/** Supabase Auth errors → messages the frozen screens can show as they are. */
export function authError(error: AuthError): ServiceError {
  const code = error.code ?? '';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return OFFLINE();
  switch (code) {
    case 'invalid_credentials':
      return new ServiceError('bad_credentials', 'That email and password do not match.', false);
    case 'user_already_exists':
    case 'email_exists':
      return new ServiceError('email_taken', 'An account already uses that email.', false);
    case 'weak_password':
      return new ServiceError('weak_password', 'That password is too easy to guess. Try a longer one.', false);
    case 'same_password':
      return new ServiceError('same_password', 'Choose a password different from your current one.', false);
    case 'otp_expired':
    case 'otp_disabled':
      return new ServiceError('bad_code', 'That code is not correct or has expired.', true);
    case 'email_address_invalid':
    case 'validation_failed':
      return new ServiceError('invalid_email', 'Enter a valid email address.', false);
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new ServiceError('rate_limited', 'Too many attempts. Wait a moment and try again.', true);
    case 'signup_disabled':
    case 'email_provider_disabled':
      return new ServiceError('unavailable', 'Creating accounts is not available right now.', false);
    case 'session_not_found':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return new ServiceError('unauthenticated', 'Your session has ended. Sign in again.', false);
    default:
      if (error.status === 429) return new ServiceError('rate_limited', 'Too many attempts. Wait a moment and try again.', true);
      return new ServiceError('auth_failed', 'Something went wrong. Try again.', true);
  }
}
