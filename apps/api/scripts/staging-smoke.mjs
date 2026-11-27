// End-to-end smoke test of a running Voya API and its Supabase project, as
// two real accounts would use it. Run it after a staging deploy:
//
//   VOYA_SMOKE_API_URL=https://<railway domain> \
//   VOYA_SMOKE_SUPABASE_URL=https://<ref>.supabase.co \
//   VOYA_SMOKE_PUBLISHABLE_KEY=sb_publishable_… \
//   VOYA_SMOKE_SECRET_KEY=sb_secret_… \
//   pnpm --filter @voya/api smoke:staging
//
// or against the local stack and a local API (`pnpm --filter @voya/api dev`):
//
//   pnpm --filter @voya/api smoke:staging -- --local
//
// Test data is explicit and short-lived: three throwaway accounts are created
// through the Auth admin API (confirmed, so no email delivery is needed),
// tagged `voya_smoke` in their metadata, on the reserved example.com domain,
// and deleted through the API's own account deletion at the end (which also
// proves deletion works on that project). They never become demo or real
// identities. Keys are read from the environment only and never printed;
// pass the secret key from your shell, never put it in a file in the repo.
//
// Checks: health, readiness, sign-in through Supabase Auth, profile, create a
// plan, share a link, a second account opens and accepts it and sees the
// plan, a third account and an anonymous caller are refused, then deletion.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const local = process.argv.includes('--local');
const keep = process.argv.includes('--keep');

function config() {
  if (!local) {
    const env = (name) => {
      const value = process.env[name];
      if (!value) throw new Error(`Set ${name}`);
      return value.replace(/\/$/, '');
    };
    const cfg = {
      api: env('VOYA_SMOKE_API_URL'),
      supabase: env('VOYA_SMOKE_SUPABASE_URL'),
      publishable: env('VOYA_SMOKE_PUBLISHABLE_KEY'),
      secret: env('VOYA_SMOKE_SECRET_KEY'),
    };
    if (!cfg.api.startsWith('https://') || !cfg.supabase.startsWith('https://')) {
      throw new Error('Hosted smoke tests need https URLs (use --local for the local stack)');
    }
    return cfg;
  }
  const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const raw = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
    cwd: apiDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const status = JSON.parse(raw.slice(raw.indexOf('{')));
  return {
    api: process.env.VOYA_SMOKE_API_URL ?? 'http://127.0.0.1:3000',
    supabase: status.API_URL ?? 'http://127.0.0.1:54321',
    publishable: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    secret: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  };
}

const cfg = config();
const run = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex')}`;
const created = []; // { label, userId, token }
let failures = 0;

const step = async (name, fn) => {
  try {
    const detail = await fn();
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${name} — ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

async function call(method, url, { token, apikey, body, expect, ifMatch } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(apikey ? { apikey } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(ifMatch !== undefined ? { 'if-match': String(ifMatch) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (expect !== undefined && res.status !== expect) {
    // Show the API's error code (never a token or key), not the raw body.
    const code = json?.error?.code ?? json?.error_code ?? json?.code ?? '';
    throw new Error(`${method} ${new URL(url).pathname} → ${res.status}${code ? ` ${code}` : ''}, expected ${expect}`);
  }
  return { status: res.status, body: json, headers: res.headers };
}

const api = (method, path, options) => call(method, `${cfg.api}/api/v1${path}`, options);

async function account(label) {
  const email = `voya-smoke-${run}-${label}@example.com`;
  const password = `Smoke-${randomBytes(12).toString('base64url')}`;
  const admin = await call('POST', `${cfg.supabase}/auth/v1/admin/users`, {
    apikey: cfg.secret,
    body: { email, password, email_confirm: true, user_metadata: { first_name: `Smoke ${label}`, voya_smoke: run } },
    expect: 200,
  });
  const entry = { label, userId: admin.body.id, token: undefined };
  created.push(entry);
  const session = await call('POST', `${cfg.supabase}/auth/v1/token?grant_type=password`, {
    apikey: cfg.publishable,
    body: { email, password },
    expect: 200,
  });
  entry.token = session.body.access_token;
  return entry;
}

async function cleanup() {
  if (keep) {
    console.log(`  • kept ${created.length} smoke accounts (voya_smoke=${run})`);
    return;
  }
  for (const entry of created.reverse()) {
    // Normal path: the API's own deletion (profile, plans hand-over, auth user).
    const viaApi = entry.token ? await api('DELETE', '/me', { token: entry.token }).catch(() => undefined) : undefined;
    if (viaApi?.status === 204) continue;
    // Fallback so a failed run leaves nothing behind.
    await call('DELETE', `${cfg.supabase}/auth/v1/admin/users/${entry.userId}`, { apikey: cfg.secret }).catch(() => undefined);
    console.log(`  • removed smoke account ${entry.label} through the admin API (API deletion did not answer 204)`);
  }
}

console.log(`Voya smoke test (${local ? 'local' : 'hosted'}) — run ${run}`);
console.log(`  API ${new URL(cfg.api).host} · Supabase ${new URL(cfg.supabase).host}`);
try {
  await step('liveness /health', async () => (await call('GET', `${cfg.api}/health`, { expect: 200 })).body.status);
  await step('readiness /health/ready', async () => {
    const ready = await call('GET', `${cfg.api}/health/ready`, { expect: 200 });
    return Object.entries(ready.body.checks ?? {}).map(([k, v]) => `${k} ${v.status}`).join(', ');
  });
  await step('anonymous calls are refused', async () => {
    await api('GET', '/me', { expect: 401 });
    await api('GET', '/plans', { token: 'not-a-token', expect: 401 });
  });

  let a, b, c, planId, token;
  await step('register and sign in three test accounts through Supabase Auth', async () => {
    a = await account('a');
    b = await account('b');
    c = await account('c');
  });
  await step('fetch the profile (provisioned on first call)', async () => {
    const me = await api('GET', '/me', { token: a.token, expect: 200 });
    if (me.body.auth.authUserId !== a.userId) throw new Error('profile is not the signed-in account');
    return `profile ${me.body.profile.id.slice(0, 8)}…`;
  });
  await step('create a plan', async () => {
    const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const plan = await api('POST', '/plans/hangouts', {
      token: a.token,
      body: { title: 'Smoke test hangout', city: 'Riyadh', template: 'Dinner', startsAt },
      expect: 201,
    });
    planId = plan.body.id;
    return `hangout ${planId.slice(0, 8)}…`;
  });
  await step('share an invitation link (token returned once)', async () => {
    const link = await api('POST', `/plans/${planId}/invitations`, { token: a.token, body: {}, expect: 201 });
    token = link.body.invitation.token;
    const list = await api('GET', `/plans/${planId}/invitations`, { token: a.token, expect: 200 });
    if (JSON.stringify(list.body).includes(token)) throw new Error('link list exposes the token');
  });
  await step('second account opens and accepts the link', async () => {
    const preview = await api('POST', '/invitations/resolve', { token: b.token, body: { token }, expect: 200 });
    if (preview.body.planId !== planId) throw new Error('link resolves to another plan');
    await api('POST', '/invitations/accept', { token: b.token, body: { token }, expect: 200 });
    const again = await api('POST', '/invitations/accept', { token: b.token, body: { token }, expect: 200 });
    if (again.body.planId !== planId) throw new Error('repeated accept changed the plan');
    await api('POST', `/plans/${planId}/response`, { token: b.token, body: { answer: 'accept' }, expect: 200 });
  });
  await step('both accounts retrieve the same plan', async () => {
    const meB = await api('GET', '/me', { token: b.token, expect: 200 });
    const seenByB = await api('GET', `/plans/${planId}`, { token: b.token, expect: 200 });
    const seenByA = await api('GET', `/plans/${planId}`, { token: a.token, expect: 200 });
    if (seenByA.body.id !== seenByB.body.id) throw new Error('different plans');
    if (!seenByA.body.members.some((m) => m.personId === meB.body.profile.id)) throw new Error('second account is not a member');
    return `${seenByA.body.members.length} members, version ${seenByA.body.version}`;
  });
  await step('a third account cannot see or change the plan', async () => {
    await api('GET', `/plans/${planId}`, { token: c.token, expect: 404 });
    await api('PATCH', `/plans/${planId}`, { token: c.token, body: { title: 'x' }, ifMatch: 1, expect: 404 });
    const list = await api('GET', '/plans', { token: c.token, expect: 200 });
    if (list.body.items.some((p) => p.id === planId)) throw new Error('plan listed for an outsider');
  });
  await step('a revoked link is refused', async () => {
    const link = await api('POST', `/plans/${planId}/invitations`, { token: a.token, body: {}, expect: 201 });
    await api('DELETE', `/plans/${planId}/invitations/${link.body.summary.id}`, { token: a.token, expect: 204 });
    await api('POST', '/invitations/accept', { token: c.token, body: { token: link.body.invitation.token }, expect: 410 });
  });
  await step('account deletion hands the plan over and ends the session', async () => {
    await api('DELETE', '/me', { token: a.token, expect: 204 });
    await api('GET', '/me', { token: a.token, expect: 401 });
    const seenByB = await api('GET', `/plans/${planId}`, { token: b.token, expect: 200 });
    const meB = await api('GET', '/me', { token: b.token, expect: 200 });
    if (seenByB.body.ownerId !== meB.body.profile.id) throw new Error('plan was not handed to the remaining member');
    a.token = undefined; // already deleted
    created.splice(created.indexOf(a), 1);
  });
} catch {
  // reported by step()
} finally {
  await cleanup();
}

console.log(failures === 0 ? 'Smoke test passed.' : `Smoke test FAILED (${failures} step).`);
console.log('Logs: check the API logs for this window contain no tokens, keys or passwords (see docs/backend.md).');
process.exit(failures === 0 ? 0 : 1);
