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

/** The local stack's public anon key (a well-known local default, read at runtime). */
export function localAnonKey(): string {
  const raw = execFileSync('supabase', ['status', '-o', 'json'], {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  const key = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  if (!key) throw new Error('Local Supabase is not running: run `pnpm --filter @voya/api supabase:start`');
  return key;
}

/** Signs up a throwaway user with local Supabase Auth and returns its access token. */
export async function signUpTestUser(env: Env, email: string): Promise<{ accessToken: string; userId: string }> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: localAnonKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: `it-${Math.random().toString(36).slice(2)}-Aa1` }),
  });
  const body = (await res.json()) as { access_token?: string; user?: { id: string } };
  if (!res.ok || !body.access_token || !body.user) throw new Error(`Sign-up failed (${res.status})`);
  return { accessToken: body.access_token, userId: body.user.id };
}
