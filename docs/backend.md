# Backend

The Voya API: a NestJS modular monolith over Supabase PostgreSQL (Prisma) and
Supabase Auth, sharing Zod contracts with the mobile app. This is the single
backend reference: setup, structure, decisions and milestones.

**Status (B1, 2026-11-27):** real authentication, profiles, preferences,
avatars and account deletion work end to end against the local stack. The
mobile app uses them when real mode is on (`EXPO_PUBLIC_VOYA_AUTH=supabase`
in development; always in non-development builds); mock mode stays the
development default. Nothing is deployed.

**Status (B2, 2026-11-28):** the API serves plans, membership and
invitations (see "Plans, membership and invitations"), and account deletion
hands shared plans over instead of refusing. In real mode the app's plans,
plan people, invitations and per-plan mutes now come from the API; actions
that belong to B3 (votes, schedules, itineraries…) refuse in real mode
instead of changing a local copy. Saves, activity and Explore are still
mock services. Mock mode is unchanged.

**Status (B2.5, 2026-11-28):** staging on Supabase Cloud + Railway is
prepared and validated locally but **not provisioned or deployed** (awaiting
approval). See "Staging". The API now refuses to boot a hosted environment
that is not bound to exactly one Supabase project, local database commands
refuse hosted databases, sensitive endpoints are rate limited, and release
app builds refuse local backends.

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
        plans/              plans, membership, invitations, people, mutes (B2)
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

Feature modules map to Voya domains: **Auth/Identity, Users, Places,
Health** (B0/B1) and **Plans** (B2: plans, membership, invitations).
**Activities, Notifications** already have tables and get their modules
when their milestones start, rather than as empty boilerplate now.

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

`db:migrate`, `db:seed` and `db:reset` refuse a non-loopback database, and
`db:deploy` refuses a hosted one unless `VOYA_CONFIRM_REMOTE_MIGRATION` names
its project ref (`scripts/db-guard.mjs`). Hosted databases are migrated by
Railway's pre-deploy step.

Every new table must enable RLS and revoke `anon`/`authenticated` in its
migration, as the init migration does.

## Environment variables

All read and validated once in `src/config/env.ts`; the API refuses to start
on an invalid environment and names the bad variables (never their values).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | | `development` | `production` enables extra safety checks; requires `APP_ENV` staging/production |
| `APP_ENV` | | `local` | `local`/`test`/`staging`/`production`; seeding refuses staging/production |
| `PORT`, `HOST` | | `3000`, `0.0.0.0` | Railway sets `PORT` |
| `LOG_LEVEL` | | `info` | pino level |
| `LOG_PRETTY` | | `false` | Human-readable logs; rejected in production |
| `DATABASE_URL` | ✓ | | Runtime connection. Hosted: Supabase pooler (`:6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | ✓ for Prisma CLI | | Direct connection for migrations (`:5432`) |
| `SUPABASE_URL` | ✓ | | Project URL; must be https in production |
| `SUPABASE_PROJECT_REF` | ✓ staging/production | | The one project `SUPABASE_URL`, `DATABASE_URL` and `DIRECT_URL` must belong to |
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
| GET | `/api/v1/plans?timing=upcoming\|past` | bearer | `PlansList`: plans the caller can see, upcoming soonest first / past latest first, each projected for the caller |
| GET | `/api/v1/plans/:id` | bearer | `Plan` (member view, or the guest view of an event); `404` when the caller may not see it |
| POST | `/api/v1/plans/hangouts` · `/events` · `/trips` | bearer | Create; the caller becomes organizer/host. Invitees and co-hosts must be people the caller already plans with |
| PATCH | `/api/v1/plans/:id` | bearer (`plan.edit`) | Shared details, per type (`UPDATABLE_PLAN_FIELDS`); `If-Match` **required**, `409` when stale |
| POST | `/api/v1/plans/:id/cancel` | bearer (event host) | Event becomes `cancelled`, read-only for everyone; `If-Match` optional |
| POST | `/api/v1/plans/:id/invitees` | bearer (`invite.create`) | In-app invitations to people the caller already plans with |
| POST | `/api/v1/plans/:id/response` | bearer (the invitee) | `{ answer: accept\|maybe\|decline }` to one's own invitation → `{ plan \| null }` |
| DELETE | `/api/v1/plans/:id/people/:personId` | bearer (`member.manage`) | Remove a member or invitee (never the owner, never yourself) |
| POST | `/api/v1/plans/:id/owner` | bearer (owner) | `{ personId }` hand the plan to another member, atomically |
| POST | `/api/v1/plans/:id/leave` | bearer | `204`; `If-Match: <version>` optional, `409` when stale |
| DELETE | `/api/v1/plans/:id` | bearer | `204`; hangout organizer / trip `plan.delete`; events are cancelled, never deleted (`403`); `If-Match` as above |
| PUT | `/api/v1/plans/:id/mute` | bearer | `{ muted }`, H01 per-plan notifications |
| GET | `/api/v1/me/muted-plans` | bearer | `{ planIds }` |
| GET / POST | `/api/v1/plans/:id/invitations` | bearer (`invite.create`) | List links (never the token) / create one: the raw token is returned once |
| DELETE | `/api/v1/plans/:id/invitations/:invitationId` | bearer (`invite.create`) | Revoke (idempotent) |
| POST | `/api/v1/invitations/resolve` · `/accept` | bearer | `{ token }` in the body. Resolve → `Invitation` (flags expired/revoked); accept → `{ planId, planType, alreadyMember }`, `410 expired` / `410 revoked` |
| GET | `/api/v1/people` | bearer | `PeopleList`: everyone the caller plans with (see below) |
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

**Authorization:** every `/me` route resolves the caller from the token in
the service layer; no route takes a user or profile id to act on, and
request bodies reject id fields (`.strict()` schemas). Plan routes take a
plan id and decide access from the caller's relation to that plan (below).

### Preferences: where each setting lives

| Setting | Where | Why |
|---|---|---|
| Profile: names, city, bio, interests, onboarding step, photo | Postgres `profiles` (+ Storage) | Account data, every device |
| Notification preferences (V04), precise location, discovery radius (V06) | Postgres `account_settings` (row created on first change; defaults from `DEFAULT_ACCOUNT_PREFERENCES`) | Account preferences the server will act on (push delivery, discovery); same on every device |
| Per-plan mute (H01) | Phone (mock store) today; the API keeps it on `plan_members` / `plan_invitees` (B2) | The app switches to the server copy with its plans (B3) |
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

**Shared plans (B2):** in the same transaction, before the profile goes,
the person is taken off every plan they own, belong to, are invited to or
are still named in, one locked plan at a time, by the policy in "Leaving
and hand-over" with `deleted` set: suggestions are credited to
`former-member`, and a plan they would still own (nobody left to hand it to,
e.g. an event with guests but no other host) is deleted. Links they created
go with the profile. If any of it fails, nothing is deleted. (The B1
`409 conflict` guard is gone.) This is genuinely atomic because Supabase
Auth's `auth.users` lives in the same Postgres database as the app tables,
so the login, the profile and the plan changes commit or roll back
together; only the photo clean-up in Storage runs afterwards, best effort
(a leftover object sits in a private folder nobody can sign for). A retry
after a failure starts again from a consistent state. Plans a real account made in real mode still
live only in the phone's mock world until B3, and are cleaned up there.

Not yet built: data export, a grace period/undo, deleting an unverified
sign-up that was abandoned (Supabase keeps it until verified or cleaned up),
and email change (V03 shows the email without a destination).

## Plans, membership and invitations (B2)

**Storage.** `plans` keeps the shared columns; each experience's own state
(hangout suggestions/timeline, trip days/picks/must-dos, event schedule and
name-only guests, `coverPhoto`) is a JSON document in `plans.details`, with
real profile and place ids inside, until B3 gives each experience tables.
Who may see a plan is never read from the JSON: it comes from two tables.

| Table | Holds |
|---|---|
| `plan_members` | Organizer, participants, travelers, hosts, co-hosts: role (label) + capabilities (what they may do) + join order + mute |
| `plan_invitees` | People invited to a plan and their answer (`pending` / `accepted` / `maybe` / `declined`, shown as in/joined/going per experience), who invited them, through which link, and their mute. For events these are the guests on Voya; the row id is the guest id |

**Relation → view** (server-side; the app's `relationTo`/`guestView` were
the simulation of this):

| Relation | Who | Sees |
|---|---|---|
| member | on `plan_members` | The whole plan |
| guest | on an event's invitees, any answer | The guest view: no host-only schedule items, no co-host settings, other guests anonymised (answers kept for counts), own row marked `viewerGuestId` |
| invited | a pending hangout/trip invitee | The plan, to show its invitation (12, 17) |
| none | anyone else, including a hangout/trip invitee who declined | `404 not_found`, the same as a plan that does not exist |

**People** (`GET /people`): on plans the caller is a member of, the other
members and invitees; on plans the caller is only a guest of or invited to,
the members (hosts/organizer), never the other guests. People added when
creating a plan must come from this set; anyone else joins by link.

**Writes** lock the plan row (`SELECT … FOR UPDATE`), check the caller's
capabilities on that plan, and bump `version` once, in one transaction.
Destructive and editing writes take `If-Match: <version>`; a stale version
is `409 conflict` and nothing is written (PATCH requires it). Two
concurrent edits from the same version: one wins, the other gets `409`.

**Membership** (role is the label, capabilities decide):

| Experience | Owner | Others | Answering an invitation |
|---|---|---|---|
| Hangout | organizer (edit, manage, invite, finalize, suggest, vote) | participants (suggest, vote) | in / maybe → participant member; can't → not a member, plan hidden (they can still change their answer) |
| Trip | organizer (+ delete) | travelers (suggest, vote) | join → traveler member; decline |
| Event | host (edit, delete, manage, invite, schedule); co-hosts by permission (B3) | guests are **not** members | going / maybe / can't is their RSVP |

Hand-over (`/owner`): hangout and trip swap organizer and participant/
traveler roles; an event passes between hosts (a co-host must be made a
host first, B3). Removing someone forgets their votes and trip inputs like
leaving does. Invitees are never counted as members.

**Leaving and hand-over** (the mock's policy, now enforced): the person's
membership and invitation go; hangout votes go (their suggestions stay);
trip preferences, picks, "done choosing", replacement requests and
must-dos only they wanted go. A leaving owner hands the plan to the member
who joined next, who takes the owner's role and capabilities. A plan with
nobody left is deleted, except an event that still has guests, which stays
for them.

**Who an invitation is for.** Two kinds, matching the app: an **in-app
invitation** (13, 05, 40) is a `plan_invitees` row for one profile — only
that account can see or answer it, nobody else can claim it. An
**invitation link** is a bearer link the organizer shares (the app's "share
invite" flow): whoever opens it while signed in is put on the invite list as
themselves, and then answers like an in-app invitee. Links are not bound to
an email; email/SMS delivery and email-bound invitations come with B6.

**Invitations.** A link is 32 random bytes (base64url); only its SHA-256 is
stored and the raw token is returned once, to the creator, so a database
leak leaks no working link. Links need `invite.create`, expire (14 days by
default, at most 30) and can be revoked; a plan that is over or cancelled
takes no new links or people. Tokens travel in request bodies, never in
URLs, so they stay out of access logs. Accepting puts the person on the
invite list (pending) — answering is the plan's own invitation screen, as
for an in-app invite. Accepting again is a no-op; a declined hangout/trip
invite goes back to pending; an event guest who answered keeps the answer.
The app keeps building links behind its existing invitation boundary until
the production domain is decided.

**Not built yet:** the type-specific mutations (vote, finalize, change
requests, schedule, co-hosts and their permissions, name-only guests, host
RSVP overrides, preferences, picks, itinerary — B3), cover uploads, and
pagination of the plan list (a person's plans are listed whole). Trip dates are calendar dates; without the destination's time zone
the server anchors them in UTC (00:00–23:59) only to file trips as
upcoming/past.

### The app in real mode (B2)

`src/api/plans.ts` implements the plan services over the API; the
composition root (`src/api/index.ts`) uses it for `plans`, `invitations`,
`hangouts`, `events`, `trips`, `catalog.people` and the mute part of
settings. Real accounts now plan as their profile id. The provider keeps
the last version it saw of each plan and sends it as `If-Match`; it is
forgotten on sign-in, sign-out, session end and deletion.

| Works end to end in real mode | Refuses with `not_available` (B3) |
|---|---|
| Home lists, plan detail (server projection), create hangout / event (no cover) / trip, edit details, invite friends, answer invitations (17, 12, 20), remove someone, hand a trip over, leave, delete hangout/trip, cancel event, invitation links, per-plan mute, people pickers | Suggestions, votes, Choose together, finalize, change requests; event schedule, co-hosts, permissions, name-only guests, RSVP overrides, covers; trip preferences, picks, must-dos, itinerary, destination change; Add to Plan from Explore |

The refusals say what is not shared yet, through the screens' existing
error text; no screen changed. Nothing in real mode falls back to the
phone's mock plans.

**Real mode is not production-ready yet:** plans, saves, activity and Explore
are still device-local mocks for real accounts; social sign-in, push and
production email (SMTP, branded templates) are not set up.

## Tests

```bash
pnpm test                                       # whole workspace: mobile 232 + contracts 15 + API 86
pnpm --filter @voya/api test                    # API unit + e2e (no Docker needed)
pnpm --filter @voya/api test:integration        # API against the running local stack (33)
pnpm --filter @voya/mobile test:local-stack     # the app's real provider against the stack + a running API
pnpm --filter @voya/api smoke:staging -- --local # two-account smoke test against a running API (see Staging)
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
  bytes and clean-up, deletion (rolled back when the plan hand-over fails).
- **plan rules** (`src/__tests__/plans.rules.test.ts`): relation, the guest
  projection, timing, hand-over, forgetting a person's inputs, former-member
  credit, and that every seeded plan translates with no fixture refs left.
- **integration** (`test/integration`): real Postgres and real Supabase Auth.
  Migrations applied, RLS and grants, seed idempotency, damaged-data
  preservation, pagination without gaps, readiness, and a real sign-up token
  verified against the live JWKS and mapped to exactly one profile.
  `accounts.test.ts` (B1): sign-up with the code read from Mailpit, wrong vs
  unknown credentials, persistence across an API restart, isolation,
  refresh + sign-out revocation, the recovery link end to end, avatars in
  the private bucket (signed only; disguised files and other accounts'
  uploads refused), and deletion. `plans.test.ts` (B2): every seeded plan
  served as a valid document, plans invisible to outsiders (also by id),
  invitees limited to people already planned with, links (token shown once,
  hash stored, idempotent accept, revoked/expired refused with their code),
  the event guest view, hand-over on leave, stale `If-Match`, delete rules,
  mutes, upcoming/past, and account deletion inside shared plans.
  `plans-collab.test.ts` (B2): the brief's scenarios — A shared trip
  (invite, join, read, organizer edits, others refused), B event guests
  refused on host-only actions, C recipient-bound invitations, concurrent
  link acceptance, decline and change of mind, cancelled plans, D atomic
  hand-over, removal, last member leaving, E two concurrent edits (one
  wins, one `409`), F isolation across accounts. Needs
  `supabase:start`, `db:deploy` and `db:seed` first, and
  `SUPABASE_SECRET_KEY` in `.env`.
- **mobile** (`apps/mobile/src/api/__tests__`): the real provider against
  Supabase/API doubles (provider selection, sign-up/verify, sign-in errors,
  restore, 401 and revocation, offline sign-out, account switching,
  recovery links, settings split, avatar failures, deletion), the API
  client, chunked SecureStore, and the session store's cache clearing.
- **contracts**: schema behaviour, plus `compat/mobile.compat.ts`, a
  type-level check that the shared schemas equal the frozen app's types.

## Staging (B2.5 — prepared, awaiting approval)

Nothing is provisioned or deployed. The repository side is done and
validated locally; activating staging needs the person's approval and the
manual steps below. No Supabase or Railway project for Voya was reachable
from this machine (the Supabase CLI is not logged in; the only Railway CLI
session on the machine has expired and belongs to another project).

### Architecture

```
Voya app (staging config: EXPO_PUBLIC_* = staging URLs + publishable key)
   │  https                                   │  https (sign-up, sign-in, refresh, reset)
   ▼                                          ▼
Railway: voya-api (one service, Dockerfile) ─▶ Supabase Cloud: voya-staging
   pre-deploy: prisma migrate deploy            Postgres 17 (app tables via Prisma only)
   healthcheck: /health/ready                   Auth (ES256 JWKS), private Storage buckets
```

Local development is untouched (CLI stack + `pnpm dev`). Production will be
a second Supabase project and a second Railway environment with its own
variables; staging never shares a database, keys or users with it.

### Decisions (B2.5)

| Question | Decision | Why / trade-off |
|---|---|---|
| Supabase Cloud + Railway? | **Yes**, as proposed | Supabase Cloud runs exactly the stack the API is built and tested against (Postgres 17, GoTrue, Storage, `auth` in the same database). Railway runs one container from the repo with a pre-deploy hook and a health-gated rollout, which is all the API needs. Rejected: Fly.io/Render (equivalent, no advantage), self-hosting Supabase (operations burden), Supabase Edge Functions instead of NestJS (rewrite) |
| Dockerfile or Railway's native builder (Railpack)? | **Dockerfile** (already in `railway.json`) | It is reproducible and testable locally (built and run on this Mac), filters the pnpm workspace to the API + contracts, prunes dev dependencies, runs as `node`, and carries the Prisma engines. Railpack would have to guess the monorepo layout and gives no local equivalent |
| Auto-deploy from `main`? | **Yes, for staging**, gated by CI | One person works on `main`; staging should always be `main`. `watchPatterns` skip mobile/docs-only commits, and Railway's "Wait for CI" holds a deploy until `.github/workflows/api.yml` (typecheck, lint, tests, image build) passes, so a broken commit is never migrated into staging. Production will **not** auto-deploy |
| Separate staging and production Supabase projects? | **Yes** | Separate databases, Auth users, keys, SMTP and rate limits; staging can be reset or paused without touching real users. Supabase branching was rejected: it is tied to GitHub PR workflows this repo does not use, and costs per branch-hour |
| Migrations | **Railway pre-deploy `prisma migrate deploy`** | Runs once per deploy in the new image, before it takes traffic; a failed migration fails the deploy and the previous one keeps serving. `migrate deploy` only applies committed migrations (never resets, never generates), and takes a Postgres advisory lock so two deploys cannot migrate at once. It runs over `DIRECT_URL` (session connection; the transaction pooler cannot hold the lock) |
| Seeds | **Never on staging.** Test accounts come from the smoke script | The demo seed refuses `APP_ENV=staging/production` and, now, any non-local database. Staging test users are created on purpose, tagged and deleted (see "Test data") |
| Extra infrastructure | **None** | No worker, queue, Redis, Compose, Kubernetes or separate migration service. Rate limits are in-process (exact for the single staging instance). Add a shared store only when the API runs more than one replica |

### Environment separation (what stops mixing)

| Risk | Guard |
|---|---|
| Staging API on the production (or any other) database | `APP_ENV=staging/production` requires `SUPABASE_PROJECT_REF`; `SUPABASE_URL` must be `https://<ref>.supabase.co`, and `DATABASE_URL`/`DIRECT_URL` must belong to that ref (pooler user `postgres.<ref>` or host `db.<ref>.supabase.co`). The API refuses to boot otherwise, naming the variable, never the value |
| A hosted API on a local stack | Hosted envs reject loopback, LAN, `host.docker.internal` and `.local` database hosts and non-https Supabase URLs |
| A production image labelled local | `NODE_ENV=production` requires `APP_ENV=staging` or `production` (run the image locally with `-e NODE_ENV=development`) |
| Pooler misconfiguration | Port 6543 without `?pgbouncer=true` is refused at boot (Prisma's prepared statements break on the transaction pooler) |
| Local commands migrating staging | `db:migrate`, `db:reset`, `db:seed` refuse any non-loopback database (`scripts/db-guard.mjs`); `db:deploy` refuses a hosted database unless `VOYA_CONFIRM_REMOTE_MIGRATION=<its project ref>` is set for that one command |
| Staging/production app builds on local services | Non-development builds refuse `http`, `localhost`, `10.0.2.2`, LAN and `.local` URLs (`src/config/runtime.ts`) and report the problem instead of running |
| Mock data in a release | Unchanged: non-development builds are always real mode |

### Railway variables (staging service)

Set in Railway → service → Variables. Values never go in the repo or chat.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ENV` | `staging` |
| `SUPABASE_PROJECT_REF` | the staging project ref (20 letters, from its URL) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `DATABASE_URL` | Supabase → Connect → **Transaction pooler** URI (port `6543`) + `?pgbouncer=true&connection_limit=5` |
| `DIRECT_URL` | Supabase → Connect → **Session pooler** URI (port `5432`, user `postgres.<ref>`). Use the session pooler, not `db.<ref>.supabase.co`: the direct host is IPv6-only without Supabase's paid IPv4 add-on |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys → a **secret** key (`sb_secret_…`); mark it sealed in Railway |
| `TRUST_PROXY_HOPS` | `1` (Railway's edge proxy; real client IPs for logs and limits) |
| `LOG_LEVEL` | `info` |
| `CORS_ORIGINS` | leave empty (native apps send no Origin) |

`PORT` is set by Railway; the API listens on it. `SUPABASE_JWT_ISSUER` and
`SUPABASE_JWKS_URL` derive from `SUPABASE_URL`; the API never holds a JWT
secret.

### Manual setup — Supabase (`voya-staging`)

1. Create a project named `voya-staging` (organization of your choice;
   region: **Central EU (Frankfurt)** is the closest well-served region to
   Riyadh; pick the Railway region next to it). Save the database password
   in your password manager only.
2. **Auth → Sign In / Providers → Email:** enable email sign-up, **Confirm
   email on**, email OTP length **6**, OTP expiry 3600 s. Minimum password
   length 6 (the app's rule). Anonymous sign-ins **off**. Leave Apple/Google
   off (the app refuses them in real mode).
3. **Auth → JWT Keys:** make sure an asymmetric **ES256** signing key is the
   current key (new projects use it by default; if a legacy HS256 secret is
   current, create an ES256 key and rotate to it). The API rejects HS256.
4. **Auth → URL Configuration:** Site URL `voya://` (if the dashboard
   refuses a custom scheme, any https page you control; the app always
   sends its own `redirectTo`). Redirect URLs: `voya://**` and, while testing
   in Expo Go, `exp://**`. Nothing else.
5. **Auth → Emails → Templates:** "Confirm signup" = contents of
   `apps/api/supabase/templates/confirmation.html`, subject "Your Voya
   verification code" (must contain `{{ .Token }}`: the app verifies a
   6-digit code). "Reset password" = `recovery.html`, subject "Reset your
   Voya password" (`{{ .ConfirmationURL }}`).
6. **Auth → Emails → SMTP: custom SMTP is required for multi-user testing.**
   Supabase's built-in sender only delivers to members of your Supabase
   organization and a few emails per hour. Use a transactional provider
   (e.g. Resend, Postmark, SES) with a sender on a domain you own; then raise
   Auth → Rate Limits → emails per hour to something sensible (e.g. 30).
   Until SMTP is set, sign-up codes and reset links reach only org members.
7. **Storage:** create buckets `avatars` (private, 5 MB, `image/png,
   image/jpeg, image/webp, image/heic`) and `covers` (private, 10 MB, same
   types). No policies: the API signs every URL.
8. **Database:** do not create tables in the dashboard. The schema arrives
   only through the Railway pre-deploy migration.
9. **Settings → API Keys:** note the **publishable** key (for the app) and
   create a **secret** key for the API (`sb_secret_…`; it goes only into
   Railway and, for a smoke run, your shell).

### Manual setup — Railway

1. New project `voya` → Deploy from GitHub repo `Abilal9/voya` (grant the
   Railway GitHub app access to that repository only). Rename the
   environment to `staging`.
2. Service settings: **Root directory** empty (the repo root, so the
   Dockerfile can see `packages/contracts`); **Config-as-code path**
   `apps/api/railway.json`; branch `main`; enable **Wait for CI**.
3. Region: the one next to the Supabase region (EU West for Frankfurt).
   One replica.
4. Add the variables above **before** the first deploy (the pre-deploy
   migration and the boot check need them).
5. Networking → **Generate domain** (`*.up.railway.app`). That is
   `EXPO_PUBLIC_API_URL`. No custom domain is needed for staging.
6. Deploy. Expected: build → pre-deploy `prisma migrate deploy` applies the
   three migrations → `/health/ready` returns 200 → the deploy goes live.

### First deployment validation (after approval)

```bash
curl https://<domain>/health/ready                  # database up, migrations up
VOYA_SMOKE_API_URL=https://<domain> \
VOYA_SMOKE_SUPABASE_URL=https://<ref>.supabase.co \
VOYA_SMOKE_PUBLISHABLE_KEY=<publishable key> \
VOYA_SMOKE_SECRET_KEY=<secret key> \
pnpm --filter @voya/api smoke:staging               # type the keys in your own shell only
```

`scripts/staging-smoke.mjs` checks health and readiness, anonymous
refusal, creates three tagged test accounts through the Auth admin API,
signs them in through Supabase Auth, fetches a profile, creates a plan,
shares a link (token never listed), has the second account resolve and
accept it twice and join, checks both see the same plan, that the third
account gets `404` (read and edit) and a revoked link `410`, then deletes
the owner's account through the API (plan handed over, token refused) and
removes the rest. This also proves, on the hosted project, that the pooled
`postgres` role can read `auth.sessions` and delete from `auth.users`,
which the identity gate and account deletion depend on. It passes against
the local stack (`smoke:staging -- --local`). Afterwards, read the Railway
logs for that window: they must contain request lines without tokens,
keys, emails or passwords (verified locally: none).

Then, on a phone: sign up with a real address (needs SMTP), verify the
code, sign in, create a plan, share and open the link from a second
account, and reset a password from the emailed link. Report each of these
as verified only after it actually worked on the device.

### Test data

The demo seed (`db:seed`) is for the local stack only and refuses staging
twice (APP_ENV and the database host). On staging, test accounts are either
real sign-ups by testers or smoke accounts: `voya-smoke-<run>-<a|b|c>@example.com`,
`user_metadata.voya_smoke=<run>`, deleted at the end of each run (`--keep`
keeps them). They are never linked to seeded demo people and never used
in production.

### Mobile staging configuration

For a dev run against staging, set in `apps/mobile/.env.local` (see
`apps/mobile/.env.example`): `EXPO_PUBLIC_VOYA_AUTH=supabase`,
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable), and
`EXPO_PUBLIC_API_URL` (the Railway domain), then `pnpm start -- --clear`.
All three are public values. Password-reset links then point at the
hosted Supabase (`https://<ref>.supabase.co/auth/v1/verify…`), which a phone
can open, and return to `voya://set-password` (dev build) or
`exp://…/--/set-password` (Expo Go); PKCE keeps the link bound to the phone
that asked. Store builds (EAS) are not set up yet; when they are, the same
three variables go in the EAS `staging` environment.

### Rollback

- **Code:** Railway → Deployments → previous deployment → Redeploy (or
  `git revert` on `main`). The API is backward compatible within `/api/v1`.
- **Schema:** migrations are forward-only. A bad migration fails its deploy
  and the previous deployment keeps serving; fix forward with a new
  migration. Never `migrate reset` a hosted database. If a migration was
  applied and must be undone, write a new migration that reverses it; for
  data loss, restore Supabase's daily backup (Pro plan) or recreate staging.
- **Secrets:** rotate a leaked key in Supabase (API Keys / JWT Keys) and
  update the Railway variable; Railway redeploys on variable change.

### Costs (estimates; check current pricing pages before committing)

| Item | Plan | Approx. monthly | Drivers |
|---|---|---|---|
| Supabase staging | Free | $0 | Free projects pause after ~1 week idle and have no backups; fine for early staging |
| Supabase staging | Pro (when testing is continuous) | $25 org + compute (Micro is covered by the included credit) | Compute size, database/storage size, egress, MAU (far below limits) |
| Railway | Hobby | $5 (includes $5 of usage); one small NestJS instance usually fits | RAM × uptime, egress; no extra services |
| SMTP | Provider free tier | $0 at test volume | Emails sent |
| GitHub Actions | Free minutes | $0 | ~3–5 min per API push |

Production later roughly doubles the Supabase line (its own Pro project)
and adds its own Railway service.

### Steps that need the person's approval

1. Creating the `voya-staging` Supabase project (and choosing Free vs Pro).
2. Creating the Railway project/service and connecting the GitHub repo.
3. Choosing an SMTP provider and sender domain.
4. The first deploy (it applies migrations to the new database).
5. Running the smoke test against staging (it creates and deletes test accounts).

## Security review before staging exposure (B2.5)

Reviewed: plan access, cross-account privacy, membership roles, hand-over,
invitation links, rate limiting, replay, revoked/expired links, preview
exposure, concurrency, account deletion, logging and error sanitising.

| Area | Finding | Status |
|---|---|---|
| Plan access / privacy | Every plan route resolves the caller from the token and decides from `plan_members`/`plan_invitees`; outsiders get `404` (read and write), never a hint the plan exists. Covered by integration tests and the smoke test | OK |
| Roles / hand-over | Writes lock the plan row and check capabilities; hand-over is one transaction; owner cannot be removed | OK |
| Concurrency | Row lock + `version` + `If-Match` (PATCH requires it); two concurrent edits → one `409` (tested) | OK |
| Link tokens | 32 random bytes (256 bits), base64url; only SHA-256 stored; returned once to the creator; never in URLs, so never in access logs (verified in local logs); expire (default 14 days, max 30); revocable by members with `invite.create`; accept is idempotent; accepting only puts the person on the invite list as themselves with the experience's guest role (participant/traveler/guest capabilities only) | OK |
| Recipient-bound invitations | Unchanged: only the invited profile can see or answer them | OK |
| Rate limiting | **Was missing.** Added per-account limits: opening links (resolve + accept) 30 / 10 min, creating links 30 / h, in-app invites 60 / h, avatar upload URLs 30 / h, account deletion 5 / h → `429 rate_limited` with `Retry-After` | Fixed |
| Link preview | `resolve` shows plan title, type, inviter's first name and role, also for an expired or revoked link (so the app can say which). Brute force is infeasible at 256 bits plus the limit | Accepted (low) |
| Revocation | Revoking stops new joins; people who already joined through the link stay until removed | By design |
| Account deletion | `DELETE FROM auth.users` inside the app's transaction. Supabase's documented path is the Admin API, but deleting the row is the same operation GoTrue performs (identities, sessions, refresh tokens, MFA and one-time tokens cascade by foreign key). Failure mode is safe: if a future GoTrue table blocks the delete, the whole transaction rolls back and nothing is half-deleted. Needs `postgres`-role DELETE on `auth.users` and SELECT on `auth.sessions` on the hosted project: **verify with the first smoke run** | Open until staging run |
| Logging / errors | Authorization headers and cookies redacted; bodies not logged; driver errors, SQL and stacks never returned; env errors name variables, never values | OK |
| Public surface | Only `/health`, `/health/ready` and the read-only places catalogue are public; no admin or debug routes exist | OK |

Outstanding risks: no per-IP limit on the public places catalogue (fixture
data; add one if it is ever scraped), in-memory limits reset on deploy and
are per instance, no WAF/DDoS layer beyond Railway's edge, and the
deletion privilege above until verified on staging.

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

## Decisions (B2)

| Decision | Why |
|---|---|
| Access from `plan_members` + a new `plan_invitees` table, never from `plans.details` | Indexable "plans I can see", one source of truth for who is invited, and the JSON can never widen access |
| Type-specific state stays a JSON document until B3, with real ids inside | Serves the frozen app's shapes whole now without modelling every experience first; the seed translates fixture refs by field |
| Projections (member / guest / invited) decided on the server; outsiders get `404` | A guest's phone never receives what it must not show; existence of a plan never leaks |
| People for pickers = people you already plan with; others join by link | No user directory or search to enumerate profiles |
| Row lock per plan write, `version` bump, optional `If-Match` | Concurrent writers serialise; a client acting on a stale screen gets `409` instead of a lost update |
| Tokens in bodies, `410 expired` / `410 revoked` error codes | Tokens stay out of URLs and logs; the app's distinct expired/revoked screens map one to one |
| Deletion = hand-over in the same transaction; plans nobody can manage go | No half-deleted accounts and no ownerless plans (`plans.owner_id` stays `RESTRICT`) |
| Real mode uses server plans now and refuses B3 actions explicitly | No hybrid where a plan looks shared but its votes or schedule live on one phone |
| Links are bearer (anyone signed in who opens one joins the invite list); in-app invitations are bound to one profile | Matches the app's share-link and friend-picker flows; email-bound invites need delivery (B6) |

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

1. **B2 — Plans, memberships and invitations:** done (API + real-mode app provider).
2. **B3 — Hangouts, Events, Trips** domain APIs, one experience at a time:
   its mutations (hangout suggestions/votes/finalize; event schedule,
   co-hosts, name-only guests, covers; trip preferences/picks/itinerary),
   moving its state out of `Plan.details` into its own tables, and replacing
   that experience's `not_available` refusals in `src/api/plans.ts`.
   Suggested order: Events (host-led, fewest shared writes), Hangouts, Trips.
3. Activity, Notifications (push), social sign-in.
4. **B2.5 — staging:** prepared; activation awaits approval (see "Staging").
