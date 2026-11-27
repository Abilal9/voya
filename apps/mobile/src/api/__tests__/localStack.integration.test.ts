import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createClient, processLock } from '@supabase/supabase-js';
import { localAccountBridge } from '@/mocks/localAccount';
import { mockServices } from '@/mocks/services';
import { resetAll, simulation } from '@/mocks/store';
import { statusFor } from '@/stores/session';
import { createRealAccountServices } from '../account';
import { createRealPlanServices } from '../plans';
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
  let shared: ReturnType<typeof createRealPlanServices> | undefined;
  const services = createRealAccountServices({
    supabase,
    apiUrl: API,
    supabaseUrl: SUPABASE,
    bridge: localAccountBridge,
    mutes: { mutedPlans: () => shared!.mutedPlans(), setMutedPlans: (ids) => shared!.setMutedPlans(ids) },
    kv: memoryKv(),
    recoveryRedirect: () => 'voya://set-password',
    uploadFile: async (_uri, url, contentType) =>
      (await fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: PNG })).status,
    clearStoredSession: async () => {
      kv.map.clear();
    },
  });
  shared = createRealPlanServices(services.api);
  return { ...services, kv, shared };
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
    const settings = await phone.profile.updateSettings({ discoveryRadiusKm: 40 });
    expect(settings).toMatchObject({ discoveryRadiusKm: 40, mutedPlans: [] });

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

  it('shares a hangout between two real accounts through the API', async () => {
    const [a, b] = [device(), device()];
    const emails = [`it-mobile-a-${stamp}@example.com`, `it-mobile-b-${stamp}@example.com`];
    for (const [phone, email, name] of [[a, emails[0]!, 'Ahmad'], [b, emails[1]!, 'Khaled']] as const) {
      await phone.auth.signUp(email, 'Mobile-pass-1', { firstName: name, lastName: 'Test' });
      await phone.auth.verifyEmailCode(await codeFor(email));
    }
    const me = await a.profile.getAccount();
    const friend = await b.profile.getAccount();
    expect(me.personId).toBe(me.id);

    const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const hangout = await a.shared.plans.createHangout({ title: 'Friday', city: 'Riyadh', template: 'Dinner', startsAt });
    expect((await b.shared.plans.listUpcoming()).map((p) => p.id)).not.toContain(hangout.id);
    await expect(b.shared.plans.get(hangout.id)).rejects.toMatchObject({ code: 'not_found' });

    const invitation = await a.shared.invitations.createForPlan(hangout.id);
    expect(await b.shared.invitations.resolve(invitation.token)).toMatchObject({ planTitle: 'Friday', inviterName: 'Ahmad' });
    expect(await b.shared.invitations.accept(invitation.token)).toMatchObject({ planId: hangout.id, alreadyMember: false });
    await b.shared.plans.get(hangout.id);
    const joined = await b.shared.hangouts.respond(hangout.id, 'in');
    expect(joined.members.map((m) => m.personId)).toEqual([me.id, friend.id]);

    await a.shared.plans.get(hangout.id);
    await a.shared.hangouts.update(hangout.id, { title: 'Friday dinner' });
    expect((await b.shared.plans.get(hangout.id)).title).toBe('Friday dinner');
    await expect(b.shared.hangouts.update(hangout.id, { title: 'Mine' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(b.shared.hangouts.vote(hangout.id, 's', 'up')).rejects.toMatchObject({ code: 'not_available' });
    expect((await a.shared.people()).map((p) => p.id)).toEqual(expect.arrayContaining([me.id, friend.id]));

    // Mutes live on the server for each account.
    expect((await b.profile.updateSettings({ mutedPlans: [hangout.id] })).mutedPlans).toEqual([hangout.id]);
    expect((await a.profile.getSettings()).mutedPlans).toEqual([]);

    // The organizer deletes their account: the hangout passes to Khaled.
    await a.auth.deleteAccount();
    const handed = await b.shared.plans.get(hangout.id);
    expect(handed.ownerId).toBe(friend.id);
    await b.shared.hangouts.remove(hangout.id);
    await b.auth.deleteAccount();
  });
});
