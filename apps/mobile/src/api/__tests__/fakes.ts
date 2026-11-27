import type { Session } from '@supabase/supabase-js';

/**
 * Test doubles for the real provider: a Supabase Auth client and the Voya
 * API, both in memory. They follow the real services' observable behaviour
 * (verified separately by the API's integration tests against the local
 * stack): email-code confirmation, PKCE recovery, rotating sessions, 401s
 * for ended sessions, and the /me routes.
 */

type AuthErr = { name: string; code?: string; status?: number; message: string };
const err = (code: string, status = 400): AuthErr => ({ name: 'AuthApiError', code, status, message: code });

interface FakeUser {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  metadata: Record<string, unknown>;
}

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

export function fakeSupabase() {
  const users = new Map<string, FakeUser>();
  const codes = new Map<string, string>(); // email → current code
  const recoveryCodes = new Map<string, string>(); // PKCE code → user id
  const liveTokens = new Set<string>();
  const listeners = new Set<(event: string) => void>();
  let stored: Session | null = null;
  let offline = false;
  const calls: string[] = [];

  const sessionFor = (u: FakeUser): Session => {
    const token = `tok-${u.id}-${++seq}`;
    liveTokens.add(token);
    return {
      access_token: token,
      refresh_token: `ref-${seq}`,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: u.id, email: u.email, user_metadata: u.metadata, app_metadata: {}, aud: 'authenticated', created_at: '' },
    } as unknown as Session;
  };
  const emit = (event: string) => listeners.forEach((l) => l(event));
  const net = () => (offline ? { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } : null);

  const auth = {
    async getSession() {
      calls.push('getSession');
      return { data: { session: stored }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      calls.push('signInWithPassword');
      const n = net();
      if (n) return { data: { session: null, user: null }, error: n };
      const u = users.get(email);
      if (!u || u.password !== password) return { data: { session: null, user: null }, error: err('invalid_credentials') };
      if (!u.confirmed) return { data: { session: null, user: null }, error: err('email_not_confirmed') };
      stored = sessionFor(u);
      emit('SIGNED_IN');
      return { data: { session: stored, user: stored.user }, error: null };
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      calls.push('signUp');
      const existing = users.get(email);
      if (existing?.confirmed) return { data: { user: { id: uuid(), identities: [] }, session: null }, error: null };
      const u: FakeUser = existing ?? { id: uuid(), email, password, confirmed: false, metadata: options?.data ?? {} };
      users.set(email, u);
      codes.set(email, '135790');
      return { data: { user: { id: u.id, identities: [{}] }, session: null }, error: null };
    },
    async verifyOtp({ email, token }: { email: string; token: string }) {
      calls.push('verifyOtp');
      const u = users.get(email);
      if (!u || codes.get(email) !== token) return { data: { session: null, user: null }, error: err('otp_expired', 403) };
      u.confirmed = true;
      codes.delete(email);
      stored = sessionFor(u);
      emit('SIGNED_IN');
      return { data: { session: stored, user: stored.user }, error: null };
    },
    async resend({ email }: { email: string }) {
      calls.push('resend');
      codes.set(email, '246802');
      return { data: {}, error: null };
    },
    async resetPasswordForEmail(email: string, opts: { redirectTo: string }) {
      calls.push(`reset:${opts.redirectTo}`);
      const n = net();
      if (n) return { data: null, error: n };
      const u = users.get(email);
      if (u) recoveryCodes.set(`code-${u.id}`, u.id);
      return { data: {}, error: null };
    },
    async exchangeCodeForSession(code: string) {
      calls.push('exchangeCodeForSession');
      const id = recoveryCodes.get(code);
      const u = [...users.values()].find((x) => x.id === id);
      if (!u) return { data: { session: null, user: null }, error: err('flow_state_not_found', 404) };
      recoveryCodes.delete(code);
      stored = sessionFor(u);
      emit('SIGNED_IN');
      return { data: { session: stored, user: stored.user }, error: null };
    },
    async updateUser({ password }: { password: string }) {
      calls.push('updateUser');
      if (!stored) return { data: { user: null }, error: err('session_not_found', 401) };
      const u = [...users.values()].find((x) => x.id === stored!.user.id)!;
      if (u.password === password) return { data: { user: null }, error: err('same_password', 422) };
      u.password = password;
      return { data: { user: stored.user }, error: null };
    },
    async signOut() {
      calls.push('signOut');
      const n = net();
      if (n) return { error: n };
      if (stored) liveTokens.delete(stored.access_token);
      stored = null;
      emit('SIGNED_OUT');
      return { error: null };
    },
    onAuthStateChange(cb: (event: string) => void) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
  };

  return {
    client: { auth } as never,
    users,
    codes,
    liveTokens,
    calls,
    get stored() {
      return stored;
    },
    clearStored() {
      stored = null;
    },
    setOffline(v: boolean) {
      offline = v;
    },
    /** Supabase itself ends the session (refresh token revoked). */
    revokeFromServer() {
      if (stored) liveTokens.delete(stored.access_token);
      stored = null;
      emit('SIGNED_OUT');
    },
    /** A confirmed user, as if signed up and verified earlier. */
    addUser(email: string, password: string, metadata: Record<string, unknown> = {}) {
      const u: FakeUser = { id: uuid(), email, password, confirmed: true, metadata };
      users.set(email, u);
      return u;
    },
  };
}

export type FakeSupabase = ReturnType<typeof fakeSupabase>;

interface Profile {
  id: string;
  firstName: string;
  lastName?: string;
  displayName: string;
  city?: string;
  bio?: string;
  interests: string[];
  onboardingStep: 'profile' | 'interests' | 'location' | 'notifications' | 'done';
  avatarPath?: string;
}

const STEPS = ['profile', 'interests', 'location', 'notifications', 'done'] as const;

/** The Voya API's /me routes over the fake Supabase's users and tokens. */
export function fakeApi(sb: FakeSupabase) {
  const profiles = new Map<string, Profile>(); // by auth user id
  const settings = new Map<string, Record<string, unknown>>();
  const requests: { method: string; path: string; body?: unknown }[] = [];
  const uploads = new Map<string, string>(); // upload path → owner auth id
  let down = false;

  const json = (status: number, body?: unknown) =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;
  const fail = (status: number, code: string, message: string) =>
    json(status, { error: { code, message, retryable: status >= 500 } });

  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    if (down) throw new TypeError('Network request failed');
    const path = url.replace(/^https?:\/\/[^/]+\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path, body });
    const token = String((init.headers as Record<string, string>).authorization ?? '').replace('Bearer ', '');
    if (!sb.liveTokens.has(token)) return fail(401, 'unauthenticated', 'Your session has ended. Sign in again.');
    const userId = token.split('-').slice(1, 6).join('-');
    const user = [...sb.users.values()].find((u) => u.id === userId)!;
    let p = profiles.get(userId);
    if (!p) {
      const first = String(user.metadata.first_name ?? user.email.split('@')[0]);
      const last = user.metadata.last_name ? String(user.metadata.last_name) : undefined;
      p = { id: `prof-${userId.slice(-4)}`, firstName: first, lastName: last, displayName: [first, last].filter(Boolean).join(' '), interests: [], onboardingStep: 'profile' };
      profiles.set(userId, p);
    }
    const me = () =>
      json(200, {
        profile: {
          ...p!,
          onboardingComplete: p!.onboardingStep === 'done',
          avatarUrl: p!.avatarPath ? `http://127.0.0.1:54321/storage/v1/object/sign/avatars/${p!.avatarPath}?token=x` : undefined,
          avatarPath: undefined,
        },
        auth: { authUserId: userId, email: user.email },
      });
    const prefs = () => {
      const saved = (settings.get(userId) ?? {}) as { notifications?: Record<string, boolean> };
      return {
        preciseLocation: true,
        discoveryRadiusKm: 15,
        ...saved,
        notifications: {
          newSuggestions: true, votesAndDecisions: true, planChanges: true, itineraryReady: true, newInvitations: true,
          rsvpUpdates: true, upcomingActivities: true, scheduleChanges: true, recommendations: false, productUpdates: false,
          ...(saved.notifications ?? {}),
        },
      };
    };

    switch (`${method} ${path}`) {
      case 'GET /me':
        return me();
      case 'PATCH /me':
        if ('id' in body) return fail(422, 'validation_failed', 'Some of the details are not valid.');
        for (const [k, v] of Object.entries(body as Record<string, unknown>)) (p as unknown as Record<string, unknown>)[k] = v ?? undefined;
        return me();
      case 'PUT /me/interests':
        p.interests = body.interests;
        return me();
      case 'POST /me/onboarding': {
        const next = STEPS[Math.min(STEPS.indexOf(body.step) + 1, 4)]!;
        if (STEPS.indexOf(next) > STEPS.indexOf(p.onboardingStep)) p.onboardingStep = next;
        return me();
      }
      case 'GET /me/settings':
        return json(200, prefs());
      case 'PATCH /me/settings':
        settings.set(userId, {
          ...(settings.get(userId) ?? {}),
          ...body,
          notifications: { ...((settings.get(userId)?.notifications as object) ?? {}), ...(body.notifications ?? {}) },
        });
        return json(200, prefs());
      case 'POST /me/avatar/uploads': {
        const upload = `${p.id}/${uploads.size + 1}.jpg`;
        uploads.set(upload, userId);
        return json(201, { path: upload, uploadUrl: `http://127.0.0.1:54321/storage/v1/object/upload/sign/avatars/${upload}?token=u`, contentType: body.contentType, maxBytes: 5242880 });
      }
      case 'PUT /me/avatar':
        if (uploads.get(body.path) !== userId) return fail(422, 'validation_failed', 'That photo could not be used.');
        p.avatarPath = body.path;
        return me();
      case 'DELETE /me/avatar':
        p.avatarPath = undefined;
        return me();
      case 'DELETE /me':
        profiles.delete(userId);
        sb.users.delete(user.email);
        sb.liveTokens.forEach((t) => t.startsWith(`tok-${userId}`) && sb.liveTokens.delete(t));
        return json(204);
      default:
        return fail(404, 'not_found', 'Not found.');
    }
  }) as unknown as typeof fetch;

  return {
    fetch: fetchImpl,
    profiles,
    requests,
    setDown(v: boolean) {
      down = v;
    },
  };
}

/** In-memory KeyValue (SecureStore stand-in for non-token state). */
export function memoryKv() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => void map.set(k, v),
    removeItem: async (k: string) => void map.delete(k),
  };
}
