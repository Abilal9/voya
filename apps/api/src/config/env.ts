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
    /** Expected `iss` claim. Defaults to `${SUPABASE_URL}/auth/v1`. */
    SUPABASE_JWT_ISSUER: z.string().url().optional(),
    /** Expected `aud` claim. */
    SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),
    /** Defaults to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. */
    SUPABASE_JWKS_URL: z.string().url().optional(),

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
    if (env.NODE_ENV === 'production') {
      if (!env.SUPABASE_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Must be https in production' });
      }
      if (env.CORS_ORIGINS.includes('*')) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Wildcard origin is not allowed in production' });
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
