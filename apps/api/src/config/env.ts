import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at boot. The
 * process refuses to start on an invalid environment rather than failing on
 * the first request. Nothing else in the API reads `process.env`.
 */
const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Deployment label shown in logs, e.g. local, staging, production. */
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    LOG_PRETTY: booleanish.default('false'),

    /** Pooled runtime connection (Supabase pooler in hosted envs). */
    DATABASE_URL: z.string().url().refine((url) => url.startsWith('postgres'), 'Must be a postgres URL'),
    /** Direct (non-pooled) connection, used by Prisma Migrate only. */
    DIRECT_URL: z.string().url().optional(),

    /** Supabase project URL, e.g. http://127.0.0.1:54321 locally. */
    SUPABASE_URL: z.string().url(),
    /**
     * Hosted environments only (APP_ENV staging/production): the Supabase
     * project ref this deployment belongs to. SUPABASE_URL, DATABASE_URL and
     * DIRECT_URL must all point at this one project, so a staging API can
     * never boot against another project's database or Auth.
     */
    SUPABASE_PROJECT_REF: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^[a-z0-9]{15,40}$/, 'Must be a Supabase project ref').optional()),
    /** Expected `iss` claim. Defaults to `${SUPABASE_URL}/auth/v1`. */
    SUPABASE_JWT_ISSUER: z.string().url().optional(),
    /** Expected `aud` claim. */
    SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),
    /** Defaults to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. */
    SUPABASE_JWKS_URL: z.string().url().optional(),

    /**
     * Server-only Supabase secret key (`sb_secret_…`, or the legacy
     * service_role JWT). Used for Storage only: signed avatar upload and
     * download URLs, and removing a deleted account's photos. Never sent to
     * clients and never logged. Required in production.
     */
    SUPABASE_SECRET_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(20).optional()),
    /** Lifetime of signed avatar download URLs, in seconds. */
    AVATAR_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(7 * 24 * 3600).default(12 * 3600),

    /**
     * Origins allowed to call the API from a browser. Native mobile requests
     * carry no Origin and are unaffected. Empty = no browser origins.
     */
    CORS_ORIGINS: csv.default(''),
    /** Trust X-Forwarded-* from this many proxy hops (Railway = 1). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** Max ms to wait for in-flight requests on SIGTERM. */
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(0).max(60000).default(10000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.APP_ENV !== 'staging' && env.APP_ENV !== 'production') {
      ctx.addIssue({ code: 'custom', path: ['APP_ENV'], message: 'Must be staging or production when NODE_ENV is production' });
    }
    if (env.APP_ENV === 'staging' || env.APP_ENV === 'production') {
      hostedIssues(env).forEach(([path, message]) => ctx.addIssue({ code: 'custom', path: [path], message }));
    }
    if (env.NODE_ENV === 'production') {
      if (!env.SUPABASE_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Must be https in production' });
      }
      if (env.CORS_ORIGINS.includes('*')) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Wildcard origin is not allowed in production' });
      }
      if (!env.SUPABASE_SECRET_KEY) {
        ctx.addIssue({ code: 'custom', path: ['SUPABASE_SECRET_KEY'], message: 'Required in production (avatar storage)' });
      }
      if (env.LOG_PRETTY) {
        ctx.addIssue({ code: 'custom', path: ['LOG_PRETTY'], message: 'Pretty logs are for local development only' });
      }
    }
  })
  .transform((env) => ({
    ...env,
    SUPABASE_JWT_ISSUER: env.SUPABASE_JWT_ISSUER ?? `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`,
    SUPABASE_JWKS_URL:
      env.SUPABASE_JWKS_URL ?? `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`,
  }));

export type Env = z.infer<typeof EnvSchema>;

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|host\.docker\.internal|[^.]+\.local)$/i;

/**
 * Staging and production must be wired to exactly one hosted Supabase
 * project: no loopback/LAN hosts (a local stack), and the same project ref in
 * the Auth URL and both database URLs (no staging API on another project's
 * database). Messages name the variable, never its value.
 */
function hostedIssues(env: {
  NODE_ENV: string;
  SUPABASE_PROJECT_REF?: string;
  SUPABASE_URL: string;
  DATABASE_URL: string;
  DIRECT_URL?: string;
}): [string, string][] {
  const issues: [string, string][] = [];
  if (env.NODE_ENV !== 'production') issues.push(['NODE_ENV', 'Must be production in staging and production']);
  const ref = env.SUPABASE_PROJECT_REF;
  if (!ref) {
    issues.push(['SUPABASE_PROJECT_REF', 'Required in staging and production']);
    return issues;
  }
  if (new URL(env.SUPABASE_URL).hostname !== `${ref}.supabase.co`) {
    issues.push(['SUPABASE_URL', 'Must be the project URL of SUPABASE_PROJECT_REF']);
  }
  const databases: [string, string | undefined][] = [['DATABASE_URL', env.DATABASE_URL], ['DIRECT_URL', env.DIRECT_URL]];
  for (const [name, value] of databases) {
    if (!value) continue;
    const url = new URL(value);
    if (LOCAL_HOST.test(url.hostname)) issues.push([name, 'Must be a hosted database, not a local one']);
    // Pooler: user `postgres.<ref>`; direct: host `db.<ref>.supabase.co`.
    const bound = url.username.endsWith(`.${ref}`) || url.hostname === `db.${ref}.supabase.co`;
    if (!bound) issues.push([name, 'Must belong to SUPABASE_PROJECT_REF']);
    if (name === 'DATABASE_URL' && url.port === '6543' && url.searchParams.get('pgbouncer') !== 'true') {
      issues.push([name, 'The transaction pooler (port 6543) needs ?pgbouncer=true']);
    }
  }
  if (!env.DIRECT_URL) issues.push(['DIRECT_URL', 'Required in staging and production (migrations)']);
  return issues;
}

/**
 * Parses `source` (normally `process.env`). Throws one readable error listing
 * every invalid variable by NAME only; values are never echoed because they
 * may be secrets.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
