# Backend

The Voya API: a NestJS modular monolith over Supabase PostgreSQL (Prisma) and
Supabase Auth, sharing Zod contracts with the mobile app. This is the single
backend reference: setup, structure, decisions and milestones.

**Status (B1, 2026-11-27):** real authentication, profiles, preferences,
avatars and account deletion work end to end against the local stack. The
mobile app uses them when real mode is on (`EXPO_PUBLIC_VOYA_AUTH=supabase`
in development; always in non-development builds); mock mode stays the
development default. Plans, saves, activity and Explore are still mock
services (B2 onward). Nothing is deployed.

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
        storage/            Server-only Supabase Storage client (signed URLs; holds the secret key)
        users/              identity gate + mapping, /me profile, preferences, avatar, deletion
        places/             read-only catalogue, GET /api/v1/places[/:id]
      prisma/
        schema.prisma       App schema (public)
        migrations/         Prisma Migrate history — the only way the schema changes
        seed.ts             Idempotent demo seed (refuses staging/production)
        seed/fixtures.json  Snapshot of the mobile fixtures (people, places, plans)
      supabase/config.toml  Local Supabase stack (Auth, Storage buckets, Postgres 17)
      supabase/templates/   Auth email templates (6-digit sign-up code, reset link)
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

Then put the local stack's server-only secret key into `apps/api/.env` (it is
left blank in the example; without it the API runs but photos report "not
available"):

```bash
pnpm --filter @voya/api supabase status        # copy SECRET_KEY (sb_secret_…) into SUPABASE_SECRET_KEY
```

Smoke check:

```bash
curl localhost:3000/health/ready
curl "localhost:3000/api/v1/places?limit=2&city=Riyadh"
```

Emails (sign-up codes, reset links) never leave the machine: read them in
Mailpit at http://127.0.0.1:54324. After changing `supabase/config.toml` or
a template, restart the stack (`supabase:stop` then `supabase:start`; data
is kept).

### Running the app against the local backend (real mode)

```bash
pnpm --filter @voya/mobile env:local           # writes apps/mobile/.env.local: real auth + local publishable key
pnpm --filter @voya/api dev                    # API on :3000
pnpm start -- --clear                          # Metro picks up the new env
```

Delete `apps/mobile/.env.local` (and restart Metro with `--clear`) to go back
to mock mode. The app finds the backend through Metro's host, so nobody types
an IP address into the app:

| Where the app runs | Supabase / API it uses | Notes |
|---|---|---|
| iOS Simulator | `localhost:54321` / `localhost:3000` | Works as is |
| Android Emulator | `10.0.2.2:54321` / `10.0.2.2:3000` | Loopback is mapped automatically |
| Phone on the same Wi-Fi (Expo Go) | the Mac's LAN address from Metro | Docker publishes Supabase on all interfaces and the API binds `0.0.0.0`; the Mac's firewall must allow ports 3000 and 54321 |

Explicit `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_API_URL` win (staging).
Signed photo URLs come back from the API with the API's view of the
Supabase host; the app re-points their origin at the Supabase URL it uses
itself, so photos load on every device.

**Physical-device limitation:** the password-reset email links to Supabase
at `127.0.0.1:54321` (the stack's external URL), which a phone cannot open.
Sign-up codes, sign-in, profile and photos work on a phone; testing the
reset link on a phone needs either `[auth] external_url` set to the Mac's LAN
address locally or the staging project. The Simulator can open the link
from Mailpit in Safari.

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
| `SUPABASE_SECRET_KEY` | ✓ in production | | **Server-only.** Storage only (signed avatar URLs, deleting a removed account's photos). `sb_secret_…` or the legacy service_role JWT. Never logged, never sent to the app |
| `AVATAR_URL_TTL_SECONDS` | | `43200` | Lifetime of signed avatar download URLs |
| `CORS_ORIGINS` | | empty | Comma-separated browser origins (admin panel). `*` rejected in production |
| `TRUST_PROXY_HOPS` | | `0` | Set `1` behind Railway's proxy |
| `SHUTDOWN_TIMEOUT_MS` | | `10000` | Max wait for in-flight requests on SIGTERM |

Tokens are verified with public keys only; the one secret the API holds is
`SUPABASE_SECRET_KEY`, for Storage. The mobile app only ever gets the public
publishable/anon key (`EXPO_PUBLIC_SUPABASE_KEY`; the app refuses a secret key
there). Mobile variables are documented in `apps/mobile/.env.example`.

## API

Routes are versioned under `/api/v1`; health probes are unversioned. Every
route requires `Authorization: Bearer <Supabase access token>` unless marked
public.

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/health` | public | Liveness (`HealthResponse`) — Railway healthcheck |
| GET | `/health/ready` | public | DB reachable + migrations applied; 503 otherwise |
| GET | `/api/v1/me` | bearer | `MeResponse`: the caller's profile (created on first call) with a signed `avatarUrl` |
| PATCH | `/api/v1/me` | bearer | Names, city, bio (`null`/empty clears); display name follows a name change |
| PUT | `/api/v1/me/interests` | bearer | Replace interests (≤12, deduplicated) |
| POST | `/api/v1/me/onboarding` | bearer | Complete a step; onboarding only moves forward |
| GET / PATCH | `/api/v1/me/settings` | bearer | `AccountPreferences` (notifications, precise location, radius); partial patch, defaults when never set |
| POST | `/api/v1/me/avatar/uploads` | bearer | One-off signed upload URL in the caller's own folder |
| PUT | `/api/v1/me/avatar` | bearer | Commit an uploaded photo (ownership, ≤5 MB, magic bytes); old photos removed |
| DELETE | `/api/v1/me/avatar` | bearer | Back to initials |
| DELETE | `/api/v1/me` | bearer | Delete the account (profile + login), see Account lifecycle |
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

## Authentication and accounts (B1)

```
Expo app ──(email, password, code)──▶ Supabase Auth ──▶ access + refresh token (SecureStore)
   │                                                     │
   └──── Authorization: Bearer <access token> ──▶ Voya API ──▶ Prisma ──▶ Postgres / Storage
```

**Supabase Auth does credentials; the API never sees a password.** The app
calls Supabase directly for sign-up, sign-in, the emailed code, resend,
password reset and refresh; there is no credential proxy in NestJS.

| Flow | How |
|---|---|
| Sign-up (A02 → A06) | `signUp` with first/last name as user metadata; confirmations are on, so no session until the emailed 6-digit code is verified (`verifyOtp type=email`). The pending email is remembered across restarts (no password stored). An already-registered email is reported as taken |
| Sign-in (A03) | `signInWithPassword`. Right password + unverified email resumes at Verify with a fresh code. Wrong password and unknown email get the same message |
| Password reset (A04 → A05 → A11 → A12) | `resetPasswordForEmail` with `redirectTo` = the app (`voya://set-password`, or Expo Go's `exp://…/--/set-password`). PKCE: the link only works on the phone that asked. The recovery session is never treated as an app session; after the new password is saved it is signed out and the person signs in (A12). Expired/reused links say so |
| Change password (Settings) | `updateUser({ password })` on the current session |
| Session | Stored in SecureStore (chunked under the keychain limit), refreshed automatically in the foreground. Restores on restart. Refresh failure, revocation, or any API 401 clears the tokens and drops the app to signed-out; the query cache is emptied |
| Sign-out | `signOut({ scope: 'local' })` revokes this device's session server-side; the stored tokens are removed even offline |
| Apple / Google | Not configured: real mode refuses them rather than faking a session |

**Token verification (API):** ES256/RS256 via the project JWKS (cached,
rotates by `kid`), issuer, audience `authenticated`, expiry (5 s skew),
UUID subject, role `authenticated`, not anonymous. Then, on every request,
the **identity gate** checks in one query that the auth user still exists
(not deleted or banned) and that the token's `session_id` is still live in
`auth.sessions`. Signed-out, revoked and deleted sessions are refused at once
rather than when the 1-hour token expires, and a stale token can never
re-create a deleted profile. Tokens, passwords and cookies are never logged.

**Identity mapping:** one profile per auth user (`profiles.auth_user_id`
unique), created on first authenticated call by an idempotent upsert, named
from the sign-up metadata (else from the email). Seeded demo people have no
`auth_user_id`; nothing ever links by name or email.

**Authorization:** every route is under `/me` and resolves the caller from
the token in the service layer; no route takes a user or profile id, and
request bodies reject id fields (`.strict()` schemas).

### Preferences: where each setting lives

| Setting | Where | Why |
|---|---|---|
| Profile: names, city, bio, interests, onboarding step, photo | Postgres `profiles` (+ Storage) | Account data, every device |
| Notification preferences (V04), precise location, discovery radius (V06) | Postgres `account_settings` (row created on first change; defaults from `DEFAULT_ACCOUNT_PREFERENCES`) | Account preferences the server will act on (push delivery, discovery); same on every device |
| Per-plan mute (H01) | Phone (mock store), per account | Plans are still mock; becomes `plan_members` state in B2 |
| Explore likes/skips, recent searches, chosen city | Phone (mock store), per account | Explore is still mock |
| OS permissions (location, photos, notifications) | The OS | Outcomes belong to the device, not the account |
| Dev menu (simulation, clock) | Phone, `__DEV__` only | Never ships |

### Avatars

Private `avatars` bucket (5 MB, JPEG/PNG/WebP/HEIC). The app asks the API
for a one-off signed upload URL for a fresh path inside the caller's own
folder (`<profile id>/<uuid>.<ext>`), PUTs the photo there directly (no key),
then commits the path. Commit checks the folder is the caller's, the object
exists and is within the limit, and that its first bytes really are an image
of that type (the bucket only trusts the declared Content-Type); then it
swaps the photo and deletes every other object in the folder (previous photo
and abandoned uploads), so nothing is orphaned. Photos are shown through
signed URLs (12 h by default); the bucket is never public and the app never
holds a Storage key. If Storage is down, `/me` still answers and the app
shows initials.

### Account lifecycle

`DELETE /api/v1/me` removes the profile (settings and activity cascade) and
the Supabase Auth user (identities, sessions, refresh tokens cascade) **in
one transaction**, then removes the photos. Outstanding access tokens fail
immediately at the identity gate. On the phone, the account's local data is
forgotten and the device is signed out.

**B2 dependency:** an account that owns, belongs to, or created invitations
for a server plan is refused with `409 conflict` and nothing is deleted.
Deleting such an account needs the B2 ownership hand-over and membership
policy (the mock already models it: plans pass to the next member,
suggestions stay, votes go). In B1 real accounts cannot hold server plans,
so deletion always completes; their plans exist only in the phone's mock
world and are cleaned up there.

Not yet built: data export, a grace period/undo, deleting an unverified
sign-up that was abandoned (Supabase keeps it until verified or cleaned up),
and email change (V03 shows the email without a destination).

**Real mode is not production-ready yet:** plans, saves, activity and Explore
are still device-local mocks for real accounts; social sign-in, push and
production email (SMTP, branded templates) are not set up.

## Tests

```bash
pnpm test                                       # whole workspace: mobile 219 + contracts 12 + API 63
pnpm --filter @voya/api test                    # API unit + e2e (no Docker needed)
pnpm --filter @voya/api test:integration        # API against the running local stack (16)
pnpm --filter @voya/mobile test:local-stack     # the app's real provider against the stack + a running API
```

- **e2e** (`test/app.e2e.test.ts`): the real app wiring with Prisma replaced by
  a fake and the JWKS by a locally generated ES256 key. Covers health,
  request ids, security headers, CORS, validation, pagination, error
  sanitising, and token rejection (expired, wrong issuer/audience, anon role,
  HS256, garbage).
- **B1 e2e** (`test/me.e2e.test.ts`): in-memory database and storage.
  Provisioning (once, from sign-up names), deleted users and revoked
  sessions refused, profile/interests/onboarding/settings validation, two
  accounts kept apart, no id-taking routes, avatar ownership/size/type/magic
  bytes and clean-up, deletion and its B2 guard.
- **integration** (`test/integration`): real Postgres and real Supabase Auth.
  Migrations applied, RLS and grants, seed idempotency, damaged-data
  preservation, pagination without gaps, readiness, and a real sign-up token
  verified against the live JWKS and mapped to exactly one profile.
  `accounts.test.ts` (B1): sign-up with the code read from Mailpit, wrong vs
  unknown credentials, persistence across an API restart, isolation,
  refresh + sign-out revocation, the recovery link end to end, avatars in
  the private bucket (signed only; disguised files and other accounts'
  uploads refused), and deletion. Needs `supabase:start`, `db:deploy` and
  `db:seed` first, and `SUPABASE_SECRET_KEY` in `.env`.
- **mobile** (`apps/mobile/src/api/__tests__`): the real provider against
  Supabase/API doubles (provider selection, sign-up/verify, sign-in errors,
  restore, 401 and revocation, offline sign-out, account switching,
  recovery links, settings split, avatar failures, deletion), the API
  client, chunked SecureStore, and the session store's cache clearing.
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
- Staging needs, before the first deploy (needs explicit approval; nothing
  is provisioned):
  - **Supabase staging project**: asymmetric (ES256) JWT signing keys on;
    Auth → email confirmations on, OTP length 6, minimum password 6 (the
    app's sign-up rule); email templates from `apps/api/supabase/templates`
    (the sign-up template must contain `{{ .Token }}`); custom SMTP (the
    built-in sender is rate-limited and not for real users); Site URL and
    redirect allow-list = the app scheme only (`voya://**`, plus the Expo Go
    / dev-client URL while testing); anonymous sign-ins off; buckets
    `avatars` (private, 5 MB, image types) and `covers` (private, 10 MB).
    The app schema arrives only through `prisma migrate deploy`.
  - **Railway variables**: `NODE_ENV=production`, `APP_ENV=staging`,
    `DATABASE_URL` (pooler, `:6543`, `?pgbouncer=true`), `DIRECT_URL`
    (direct, `:5432`, used by the pre-deploy migration), `SUPABASE_URL`,
    `SUPABASE_SECRET_KEY` (Railway secret), `TRUST_PROXY_HOPS=1`, and
    `CORS_ORIGINS` once the admin panel exists. Staging is never seeded.
  - **App build variables**: `EXPO_PUBLIC_SUPABASE_URL`,
    `EXPO_PUBLIC_SUPABASE_KEY` (publishable), `EXPO_PUBLIC_API_URL` (the
    Railway URL). A physical-device run with working reset links is the
    first thing that genuinely needs staging.
  - **To verify on staging**: the pooled `postgres` role can read
    `auth.users`/`auth.sessions` and delete from `auth.users` (both work on
    the local stack; the identity gate and deletion depend on it).
  - Secrets live only in Railway and the Supabase dashboard; `.env`,
    `.env.local` and `supabase/signing_keys.json` stay gitignored.

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

## Decisions (B1)

| Decision | Why |
|---|---|
| The app talks to Supabase Auth directly; NestJS handles only authorization and app data | No credential proxy, no second password system; Supabase owns sessions, codes and recovery |
| Sign-up verified by the emailed 6-digit code; reset by PKCE link | Matches the frozen design (A06 code, A04/A05 link); PKCE keeps the link bound to the device |
| Live-session gate on every authenticated request (`auth.users` + `auth.sessions`) | Sign-out, revocation and deletion take effect now, not at token expiry; one indexed query |
| Profile provisioned from sign-up metadata on first call | Idempotent, no separate "create profile" step the app could skip or repeat |
| Preferences in one `account_settings` row (JSON notifications + two columns), defaults in contracts | Ten notification switches are one preference set, not ten columns; validated by Zod, checked in SQL |
| Signed upload URLs, server commit with magic-byte check, server-signed downloads | No Storage key or policies on the phone, private bucket, cannot overwrite or claim another account's object |
| Raw fetch Storage client (five calls) instead of the Supabase SDK in the API | Small, explicit, easy to fake; the secret key stays in one class |
| Deletion = profile + `auth.users` in one transaction; refused while in server plans | No half-deleted accounts; the plan hand-over policy belongs to B2 |
| Real mode always in non-development builds; mock only behind `__DEV__` | A release can never ship mock credentials or the seeded-user switcher |
| Still-mock services act as the real account in its own `sb-<uid>` namespace | Real and mock identities never mix; plans created locally stay with that account |

## Architecture review (B1)

**Commit conventions.** Keep Conventional Commits with the existing scopes
(`mobile`, `api`, `db`, `contracts`, `infra`, `config`, `admin`, plus
`integration` for cross-area work). Documentation uses `docs(<area>)`, with
`docs(architecture)` for cross-cutting docs — `docs` is a type, so a separate
`docs` scope would only duplicate it. No commitlint or hooks: one person
works on `main`, and AGENTS.md is enough. Rejected: per-feature scopes
(`auth`, `profile`), which multiply without telling more than the area does.

**Release tags.** No tags were created. A tag should mark something that was
released, and nothing has been: the frontend freeze is a commit (`96a0969`),
B0 is `264a60e`, B1 ends at the docs commit of this milestone — recorded
here, not as tags. When releases start, frontend and backend do have
different lifecycles, so tag them separately:
- **mobile**: `mobile-v<app.json version>` (e.g. `mobile-v1.0.0`) on the
  commit each store build is made from, because a store binary lives for
  months and support needs its exact source; the build number stays in EAS.
- **api**: no routine tags. Railway deploys `main` by commit SHA and the
  API stays backward-compatible under `/api/v1`; if a deploy ever needs a
  name (a breaking API version, an incident), use `api-v<major>.<minor>.<patch>`.
- No unified product version and no `frontend-`/`backend-` milestone tags:
  they would describe milestones, not artifacts.

**Docker.** Keep B0's setup unchanged. Supabase CLI owns its own containers
(Postgres, Auth, Storage, Mailpit); NestJS runs natively with `pnpm dev`
(fast watch, real debugger, no volume juggling); the production Dockerfile
builds the Railway image. Rejected for now: a development Dockerfile and
Docker Compose (they would duplicate the Supabase containers or wrap the
CLI for no gain), a worker image (there are no background jobs yet; when
B5 notifications need one it should reuse the same image with another start
command), containerized tooling (Node 20 via nvm is enough), and extra
Railway config (`railway.json` already covers build, pre-deploy migration,
healthcheck and restarts).

## Next milestones

1. **B2 — Plans, memberships and invitations:** see below.
2. **B3 — Hangouts, Events, Trips** domain APIs, one experience at a time,
   moving each out of `Plan.details` into its own tables.
3. Activity, Notifications (push), social sign-in.
4. Railway staging + Supabase staging project (needs explicit approval) —
   worth doing early in B2, since phone testing of reset links needs it.

### Recommended B2 scope

Plans become server data for real accounts, behind the existing
`PlansService`/`InvitationsService` contracts:
- `GET /api/v1/plans` (upcoming/past for the caller), `GET /plans/:id` with
  member/guest/invitee projection decided server-side (the guest view of an
  event stripped on the server, as `guestProjection` does in the mock).
- Create/leave/delete with capability checks from `plan_members` and
  `version` preconditions (`409 conflict` on a stale write).
- Invitations: create (raw token shown once, SHA-256 stored), resolve,
  accept → invitee, revoke, expiry; links stay behind the existing
  invitation boundary until the production domain is decided.
- Per-plan mute moves to `plan_members`; the people catalogue for a plan
  comes from membership.
- Account deletion's B2 dependency: ownership hand-over and membership
  removal policy (as the mock defines), then lift the `409` guard.
- Migrate the mobile plan screens per service in `src/services/index.ts`,
  one experience's read path first.
