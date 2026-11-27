import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createClient, processLock } from '@supabase/supabase-js';
import { localAccountBridge } from '@/mocks/localAccount';
import { mockServices } from '@/mocks/services';
import { resetAll, simulation } from '@/mocks/store';
import { statusFor } from '@/stores/session';
import { createRealAccountServices } from '../account';
import { memoryKv } from './fakes';

/**
 * The mobile real provider against the REAL local stack: Supabase Auth
 * (Mailpit for the emailed code), the running Voya API and Storage. Opt-in:
 *
 *   pnpm --filter @voya/api supabase:start && pnpm --filter @voya/api start:local
 *   pnpm --filter @voya/mobile test:local-stack
 *
 * Skipped otherwise, so the normal suite never needs Docker.
 */
const enabled = process.env.VOYA_LOCAL_STACK === '1';
const run = enabled ? describe : describe.skip;
const KEY = enabled ? publishableKey() : undefined;

/** The local stack's public key, from `supabase status` (never a secret key). */
function publishableKey(): string {
  const raw = execFileSync('pnpm', ['--filter', '@voya/api', 'exec', 'supabase', 'status', '-o', 'json'], {
    cwd: join(__dirname, '..', '..', '..', '..', '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return (JSON.parse(raw.slice(raw.indexOf('{'))) as { PUBLISHABLE_KEY: string }).PUBLISHABLE_KEY;
}

const SUPABASE = 'http://127.0.0.1:54321';
const API = 'http://127.0.0.1:3000';
const MAILPIT = 'http://127.0.0.1:54324';
const PNG = Uint8Array.from(Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ffbf1e0005fe02fea7d2a4c90000000049454e44ae426082', 'hex'));

async function codeFor(email: string): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`)).json()) as {
      messages: { ID: string }[];
    };
    if (list.messages[0]) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()) as { Text: string };
      const code = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no code');
}

// Node 20 has no WebSocket; Realtime is never used (the app uses Supabase for Auth only).
const realtime = { transport: class {} as never };

function device() {
  const kv = memoryKv();
  const supabase = createClient(SUPABASE, KEY!, {
    auth: { storage: kv, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce', lock: processLock },
    realtime,
  });
  const services = createRealAccountServices({
    supabase,
    apiUrl: API,
    supabaseUrl: SUPABASE,
    bridge: localAccountBridge,
    kv: memoryKv(),
    recoveryRedirect: () => 'voya://set-password',
    uploadFile: async (_uri, url, contentType) =>
      (await fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: PNG })).status,
    clearStoredSession: async () => {
      kv.map.clear();
    },
  });
  return { ...services, kv };
}

run('mobile real provider against the local stack', () => {
  const stamp = Date.now();
  jest.setTimeout(30_000);

  beforeEach(async () => {
    simulation.latencyMs = 0;
    await resetAll();
  });

  it('signs up with the emailed code, edits the profile, uploads a photo, restores, signs out, and deletes', async () => {
    const email = `it-mobile-${stamp}@example.com`;
    const phone = device();
    await phone.auth.signUp(email, 'Mobile-pass-1', { firstName: 'Mobile', lastName: 'Tester' });
    expect(statusFor(await phone.profile.getAccount())).toBe('verifying');
    await phone.auth.verifyEmailCode(await codeFor(email));

    let account = await phone.profile.getAccount();
    expect(account).toMatchObject({ firstName: 'Mobile', lastName: 'Tester', email, onboardingStep: 'profile' });
    account = await phone.profile.updateProfile({ firstName: 'Mobile', city: 'Riyadh', bio: undefined });
    expect(account.city).toBe('Riyadh');
    await phone.profile.setInterests(['Coffee', 'Padel']);
    await phone.profile.completeOnboardingStep('profile');
    const settings = await phone.profile.updateSettings({ discoveryRadiusKm: 40, mutedPlans: ['local-plan'] });
    expect(settings).toMatchObject({ discoveryRadiusKm: 40, mutedPlans: ['local-plan'] });

    account = await phone.profile.setAvatar('file:///picked/photo.png');
    const photo = await fetch(account.avatarRef!);
    expect(photo.status).toBe(200);
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(PNG);

    // The still-mock services act as this account only.
    expect(await mockServices.plans.listUpcoming()).toEqual([]);

    // Restart: same stored session, same profile from the server.
    const restarted = { ...phone, ...createRealAccountServices({
      supabase: createClient(SUPABASE, KEY!, { auth: { storage: phone.kv, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, lock: processLock }, realtime }),
      apiUrl: API, supabaseUrl: SUPABASE, bridge: localAccountBridge, kv: memoryKv(),
      recoveryRedirect: () => 'voya://set-password', uploadFile: async () => 500, clearStoredSession: async () => phone.kv.map.clear(),
    }) };
    expect((await restarted.auth.getSession())?.email).toBe(email);
    expect(await restarted.profile.getAccount()).toMatchObject({ city: 'Riyadh', interests: ['Coffee', 'Padel'], onboardingStep: 'interests' });

    await restarted.auth.signOut();
    expect(await restarted.auth.getSession()).toBeNull();
    await expect(restarted.auth.signIn(email, 'wrong-pass-1')).rejects.toThrow('That email and password do not match.');
    await restarted.auth.signIn(email, 'Mobile-pass-1');
    expect((await restarted.profile.getSettings()).discoveryRadiusKm).toBe(40);

    await restarted.auth.deleteAccount();
    expect(await restarted.auth.getSession()).toBeNull();
    await expect(restarted.auth.signIn(email, 'Mobile-pass-1')).rejects.toThrow('That email and password do not match.');
  });
});
