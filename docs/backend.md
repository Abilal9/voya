# Backend

The Voya API: a NestJS modular monolith over Supabase PostgreSQL (Prisma) and
Supabase Auth, sharing Zod contracts with the mobile app. This is the single
backend reference: setup, structure, decisions and milestones.

**Status (B0, 2026-11-27):** foundation working locally. The mobile app still
runs entirely on its mocks; nothing in `apps/mobile` talks to the API yet.

## Layout

```
voya/
  apps/
    mobile/                 Expo app (frozen at F9; still on mock services)
    api/                    NestJS API
      src/
        main.ts             Boot: validate env, listen, graceful shutdown
        bootstrap.ts        Prefix, versioning, CORS, helmet, body limit (shared with tests)
        app.module.ts       Root module: logging, global pipe/filter, feature modules
        config/             env.ts (Zod-validated environment), ConfigModule (ENV token)
        common/
          errors/           AppError + global filter → ApiError envelope
          validation/       zodDto() + global ZodValidationPipe
          http/             request id (x-request-id)
        database/           PrismaService (lazy connect, disconnect on shutdown), enum mapping
        auth/               Supabase JWT (JWKS) verifier, global AuthGuard, @Public, @CurrentAuth
        health/             /health, /health/ready
        users/              identity mapping (auth user → profile), GET /api/v1/me
        places/             read-only catalogue, GET /api/v1/places[/:id]
      prisma/
        schema.prisma       App schema (public)
        migrations/         Prisma Migrate history — the only way the schema changes
        seed.ts             Idempotent demo seed (refuses staging/production)
        seed/fixtures.json  Snapshot of the mobile fixtures (people, places, plans)
      supabase/config.toml  Local Supabase stack (Auth, Storage buckets, Postgres 17)
      test/                 e2e tests (mocked DB + local JWKS) and integration tests (real stack)
      Dockerfile            Production image (build from the repo root)
      railway.json          Railway build/deploy/healthcheck config
      .env.example          Every variable, with safe local defaults
  packages/
    contracts/              @voya/contracts — Zod schemas shared by API and clients
      compat/               Compile-time check that contracts == mobile types
```

Feature modules map to Voya domains. B0 ships **Auth/Identity, Users, Places**
and **Health**. **Plans, Invitations, Membership, Activities, Notifications**
already have tables (see Schema) and get their modules when their milestones
start, rather than as empty boilerplate now.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20.11+ | The Mac's default nvm node is 12: `nvm use 20` first |
| pnpm | 9.12 (corepack) | `corepack enable` |
| Docker | Docker Desktop running | Local Supabase runs in containers |
| Supabase CLI | 2.x | **Installed per project** as a devDependency of `@voya/api` — nothing global. Run it as `pnpm --filter @voya/api supabase …` |

## Local setup

From the repository root:

```bash
nvm use 20
corepack enable
pnpm install                                   # also builds @voya/contracts
cp apps/api/.env.example apps/api/.env         # safe local defaults
pnpm --filter @voya/api supabase:start         # first run pulls images (~several minutes)
pnpm --filter @voya/api db:deploy              # apply migrations
pnpm --filter @voya/api db:seed                # demo data (idempotent)
pnpm --filter @voya/api dev                    # API on http://localhost:3000 (watch mode)
```

`supabase:start` first generates `apps/api/supabase/signing_keys.json`, a
local-only ES256 private key Supabase Auth signs tokens with (gitignored).
Studio is on http://127.0.0.1:54323 for looking only; never change the schema
there. Stop the stack with `pnpm --filter @voya/api supabase:stop`.

Smoke check:

```bash
curl localhost:3000/health/ready
curl "localhost:3000/api/v1/places?limit=2&city=Riyadh"
```

### Database workflow

Prisma Migrate owns the app tables in `public`; Supabase owns `auth`,
`storage` and its other schemas (never model or migrate those).

| Task | Command (`pnpm --filter @voya/api …`) |
|---|---|
| Change the schema | edit `prisma/schema.prisma`, then `db:migrate --name <change>` (creates + applies a migration) |
| Hand-written SQL (RLS, grants) | `db:migrate --create-only --name <change>`, edit the SQL, then `db:migrate` |
| Apply migrations (CI, deploy) | `db:deploy` |
| Status | `db:status` |
| Seed | `db:seed` (upserts by `seed_ref`; safe to repeat) |
| Start over | `db:reset` (drops, re-applies every migration, re-seeds) |

Every new table must enable RLS and revoke `anon`/`authenticated` in its
migration, as the init migration does.

## Environment variables

All read and validated once in `src/config/env.ts`; the API refuses to start
on an invalid environment and names the bad variables (never their values).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | | `development` | `production` enables extra safety checks |
| `APP_ENV` | | `local` | `local`/`test`/`staging`/`production`; seeding refuses staging/production |
| `PORT`, `HOST` | | `3000`, `0.0.0.0` | Railway sets `PORT` |
| `LOG_LEVEL` | | `info` | pino level |
| `LOG_PRETTY` | | `false` | Human-readable logs; rejected in production |
| `DATABASE_URL` | ✓ | | Runtime connection. Hosted: Supabase pooler (`:6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | ✓ for Prisma CLI | | Direct connection for migrations (`:5432`) |
| `SUPABASE_URL` | ✓ | | Project URL; must be https in production |
| `SUPABASE_JWT_ISSUER` | | `${SUPABASE_URL}/auth/v1` | Expected `iss` |
| `SUPABASE_JWT_AUDIENCE` | | `authenticated` | Expected `aud` |
| `SUPABASE_JWKS_URL` | | `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` | Public keys |
| `CORS_ORIGINS` | | empty | Comma-separated browser origins (admin panel). `*` rejected in production |
| `TRUST_PROXY_HOPS` | | `0` | Set `1` behind Railway's proxy |
| `SHUTDOWN_TIMEOUT_MS` | | `10000` | Max wait for in-flight requests on SIGTERM |

The API holds **no Supabase secret**: it verifies tokens with public keys and
connects to Postgres directly. When a later milestone needs the service-role
(secret) key, e.g. for Storage signed URLs, it is added here as a server-only
variable and never shipped to the app. The mobile app only ever gets the
public anon/publishable key.

## API

Routes are versioned under `/api/v1`; health probes are unversioned. Every
route requires `Authorization: Bearer <Supabase access token>` unless marked
public.

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/health` | public | Liveness (`HealthResponse`) — Railway healthcheck |
| GET | `/health/ready` | public | DB reachable + migrations applied; 503 otherwise |
| GET | `/api/v1/me` | bearer | `MeResponse`: the caller's profile, created on first call |
| GET | `/api/v1/places?limit&cursor&city&category` | public (B0) | `PlacesPage`, cursor-paginated |
| GET | `/api/v1/places/:id` | public (B0) | `Place` |

Every error has one shape (`ApiError` in contracts):

```json
{ "error": { "code": "validation_failed", "message": "Some of the details are not valid.",
             "retryable": false, "requestId": "…", "issues": [{ "path": "query.limit", "message": "…" }] } }
```

Codes map to statuses in `ERROR_STATUS` and onto the app's existing
`ServiceError(code, message, retryable)`. Messages are chosen by the server
from the code; driver errors, SQL and stack traces are logged, never returned.

Cross-cutting behaviour: `x-request-id` is accepted (if well-formed) or minted,
echoed, and attached to every log line and error body; JSON logs via pino with
`authorization` and cookies redacted; helmet headers; 100 kB JSON body limit;
CORS closed unless `CORS_ORIGINS` lists an origin (native apps send no Origin).

## Tests

```bash
pnpm test                                       # whole workspace: mobile 167 + contracts + API
pnpm --filter @voya/api test                    # API unit + e2e (no Docker needed)
pnpm --filter @voya/api test:integration        # against the running local stack
```

- **e2e** (`test/app.e2e.test.ts`): the real app wiring with Prisma replaced by
  a fake and the JWKS by a locally generated ES256 key. Covers health,
  request ids, security headers, CORS, validation, pagination, error
  sanitising, and token rejection (expired, wrong issuer/audience, anon role,
  HS256, garbage).
- **integration** (`test/integration`): real Postgres and real Supabase Auth.
  Migrations applied, RLS and grants, seed idempotency, damaged-data
  preservation, pagination without gaps, readiness, and a real sign-up token
  verified against the live JWKS and mapped to exactly one profile. Needs
  `supabase:start`, `db:deploy` and `db:seed` first.
- **contracts**: schema behaviour, plus `compat/mobile.compat.ts`, a
  type-level check that the shared schemas equal the frozen app's types.

## Deployment (Railway — prepared, not deployed)

- Image: `apps/api/Dockerfile`, built from the repo root. Installs only the API
  and contracts, builds both, prunes to production dependencies, runs as the
  `node` user. No secrets in the image.
- `apps/api/railway.json`: Dockerfile builder, watch paths, **pre-deploy
  `prisma migrate deploy`**, start `node dist/main.js`, healthcheck `/health`,
  restart on failure, overlap/draining for zero-downtime deploys. In the
  Railway service, set the config-as-code path to `apps/api/railway.json`.
- Staging needs, before the first deploy: a Supabase staging project
  (asymmetric JWT signing keys enabled), and these Railway variables:
  `NODE_ENV=production`, `APP_ENV=staging`, `DATABASE_URL` (pooler),
  `DIRECT_URL` (direct), `SUPABASE_URL`, `TRUST_PROXY_HOPS=1`, and
  `CORS_ORIGINS` once the admin panel exists. Staging is never seeded.

## Decisions (B0)

| Decision | Why |
|---|---|
| NestJS 11, Prisma 6, Zod 3, jose 5 (not the newest majors) | Stable, CommonJS-compatible, and Zod 3 matches the mobile app so contracts can be shared without a second copy |
| Contracts are Zod in `packages/contracts`, mirroring the frozen mobile types, with a compile-time equality check | One source of truth without touching the frozen app; the app adopts the package when its services migrate |
| Prisma Migrate owns `public`; Supabase CLI owns the rest; no dashboard edits | Reproducible schema; Supabase internals stay Supabase's |
| RLS on every app table, no policies, no Data API grants | The app reaches data only through the API; defence in depth if a grant slips in |
| Verify Supabase tokens with ES256/RS256 via JWKS only; HS256 rejected | The API never holds a signing secret |
| Global auth guard, `@Public()` to opt out | Secure by default |
| Profiles keyed by their own UUID, linked to `auth.users` by `auth_user_id` | Seeded demo people have no login; identity mapping is an explicit, race-safe upsert |
| `Plan` is one table for all three experiences; type-specific state in `details` (JSON) until each experience is modelled | Matches the app's `PlanBase`, avoids modelling everything before each API exists |
| Invitation tokens stored only as SHA-256 hashes | A database leak does not leak working links |
| Storage buckets `avatars` and `covers`, both private | Served via signed URLs from the API later |

## Next milestones

1. **B1 — Real authentication, users and profiles.** Supabase sign-up/sign-in,
   email code verification and password reset from the app; profile,
   onboarding, interests and settings APIs; account deletion that removes the
   profile with the auth user; avatar upload to the `avatars` bucket via
   signed URLs; a typed API client in the app behind the existing
   `AuthService`/`ProfileService` contracts, switched per service in
   `src/services/index.ts`.
2. **B2 — Plans and membership:** list/get plans with capability checks and
   `version` preconditions; guest projection server-side.
3. **B3 — Hangouts, Events, Trips** domain APIs, one experience at a time,
   moving each out of `Plan.details` into its own tables.
4. Invitations (hashed tokens, `voya.events/i/{token}`), Activity, Notifications.
5. Railway staging + Supabase staging project (needs explicit approval).
