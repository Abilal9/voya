import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, type Env } from '../../src/config/env';

/**
 * Integration tests run against the real local stack: `supabase:start`,
 * `db:migrate`, `db:seed`. They read apps/api/.env (copied from .env.example).
 */
export function localEnv(): Env {
  const file = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
  const vars: Record<string, string> = {};
  for (const line of file.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match?.[1]) vars[match[1]] = match[2] ?? '';
  }
  Object.assign(process.env, vars, { NODE_ENV: 'test', LOG_LEVEL: 'silent', LOG_PRETTY: 'false' });
  return loadEnv(process.env);
}

interface LocalStatus {
  anonKey: string;
  secretKey: string;
  mailpitUrl: string;
}
let status: LocalStatus | undefined;

/** Keys of the running local stack (well-known local defaults, read at runtime, never committed). */
export function localStatus(): LocalStatus {
  if (status) return status;
  const raw = execFileSync('supabase', ['status', '-o', 'json'], {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const json = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  const anonKey = json.PUBLISHABLE_KEY ?? json.ANON_KEY;
  const secretKey = json.SECRET_KEY ?? json.SERVICE_ROLE_KEY;
  if (!anonKey || !secretKey) throw new Error('Local Supabase is not running: run `pnpm --filter @voya/api supabase:start`');
  status = { anonKey, secretKey, mailpitUrl: json.MAILPIT_URL ?? json.INBUCKET_URL ?? 'http://127.0.0.1:54324' };
  return status;
}

export function localAnonKey(): string {
  return localStatus().anonKey;
}

/** Calls local Supabase Auth as the app would (public key only). */
export async function authCall(env: Env, path: string, body: unknown, accessToken?: string) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: localAnonKey(),
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

/** Signs in with email + password and returns the session. */
export async function signIn(env: Env, email: string, password: string): Promise<TestUser> {
  const res = await authCall(env, '/token?grant_type=password', { email, password });
  if (res.status !== 200) throw new Error(`Sign-in failed (${res.status})`);
  const user = res.body.user as { id: string };
  return {
    userId: user.id, email, password,
    accessToken: res.body.access_token as string,
    refreshToken: res.body.refresh_token as string,
  };
}

/**
 * A confirmed throwaway user (created through the Auth admin API, so the test
 * does not depend on email delivery), signed in with a password.
 */
export async function signUpTestUser(env: Env, email: string, metadata: Record<string, string> = {}): Promise<TestUser> {
  const password = `it-${Math.random().toString(36).slice(2)}-Aa1`;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: localStatus().secretKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }),
  });
  if (!res.ok) throw new Error(`Admin create user failed (${res.status})`);
  return signIn(env, email, password);
}

/** The latest email Mailpit received for `to`, as text. Polls briefly. */
export async function latestEmail(to: string): Promise<{ subject: string; text: string; html: string }> {
  const base = localStatus().mailpitUrl;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=1`)).json()) as {
      messages: { ID: string; Subject: string }[];
    };
    const first = list.messages[0];
    if (first) {
      const message = (await (await fetch(`${base}/api/v1/message/${first.ID}`)).json()) as { Text: string; HTML: string };
      return { subject: first.Subject, text: message.Text, html: message.HTML };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email for ${to}`);
}
