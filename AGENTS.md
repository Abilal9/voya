# Voya — agent and contributor conventions

Read this before changing anything. Keep it under ~300 lines: it is prepended to
every AI session, so every line here costs tokens on every call. Detail belongs
in `docs/decisions/` (ADRs), not here.

## What Voya is

A premium social planning app with three experiences — **Trips**, **Hangouts**,
**Events** — over one journey: Discover → Decide → Plan → Go.
Navigation is **Home | Explore | Profile** plus a floating peach `+`.

Voya is a group-decision product wearing a discovery product's clothes. Explore
is the most visible part; the collaboration machinery underneath is the hard part.

## Current phase

**Backend B1 done: real auth and profiles; everything else still mocked.**
The frontend is technically frozen (F9). Two providers, chosen in
`src/config/runtime.ts`: **mock** (development default) and **real**
(`EXPO_PUBLIC_VOYA_AUTH=supabase`; always in non-development builds), where
`auth` + `profile` use Supabase Auth and the API (`src/api/`) and the other
services stay mocks acting as that real account (`src/mocks/localAccount.ts`).
Plans move in B2. See `docs/backend.md`.

## Repository

```
voya/
  apps/mobile/          Expo + Expo Router app (frozen at F9)
  apps/api/             NestJS API, Prisma schema/migrations, local Supabase config
  packages/contracts/   Zod contracts shared by the API and (later) the app
  reference/            Frozen design V1 + CHECKSUMS.txt — READ ONLY
  docs/                 Inventory, progress, mock data, integration notes, backend.md
```

Do not scaffold `apps/admin` yet. Backend rules: Prisma Migrate is the only way
the app schema changes (never the Supabase dashboard); every table gets RLS on
and no `anon`/`authenticated` grants; contracts never import NestJS, Prisma or
React Native; no secrets in the repo (`.env` and `supabase/signing_keys.json`
are gitignored).

## Hard rules

1. **The frozen design is the source of truth.** `reference/voya-design-v1.html`.
   Do not redesign, do not invent screens, do not add consumer features.
   Do not render the board's device bezel, Dynamic Island or status bar — the app
   uses real OS safe areas via `<Screen>`.
2. **Never substitute brand assets.** The logo and emblem live in
   `src/components/brand/` with geometry copied verbatim from the approved SVGs.
   Do not redraw them.
3. **Tokens only.** No literal colours, font sizes, radii or spacing in
   components. Everything comes from `src/theme`. If a value is missing from the
   scale, add it to the scale.
4. **Screens never import mocks.** UI talks to `useServices()` only. A screen that
   imports from `src/mocks/*` is a bug — it is what makes the frontend disposable.
5. **Only `src/mocks/store.ts` touches AsyncStorage.**
6. **No fake success.** Never show a success state for something that did not
   happen. Never claim a device test, a provider call or a passing test that was
   not actually run.
7. **`main` is the only branch.** No feature branches, no PRs for routine work.
   Small, focused commits; never force-push or discard work.

## Commits

Conventional Commits with a monorepo scope: `type(scope): summary`.
Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.
Scopes: `mobile`, `api`, `admin`, `db`, `contracts`, `config`, `infra`,
`integration` (spans areas). Docs: `docs(<area>)`, or `docs(architecture)`
for cross-cutting docs. No milestone tags (see docs/backend.md). Split multi-area changes
into separate commits where it makes sense. Run
`pnpm typecheck && pnpm lint && pnpm test` before pushing to `origin/main`.

## Architecture boundary

```
screen / component
    → useServices()            (src/services/ServicesProvider.tsx)
        → Services interface   (src/services/contracts.ts)
            → mockServices     (src/mocks/services.ts)        ← today
            → apiServices      (generated NestJS client)      ← later
```

Swapping implementations is a change in `src/services/index.ts` and **nowhere
else**. If a change to a screen is needed to swap providers, the boundary leaked.

## Data shape honesty

Roughly 35% of the place fixtures are deliberately damaged: missing rating,
missing photo, unknown hours, permanently closed, a 50-character Arabic name.
This is on purpose. Every component that renders a `Place` must handle:

- `rating === undefined` → "No rating yet", never `0`
- `photo === undefined` → placeholder, never a broken image
- `openNow === undefined` → "Hours unknown", which is **not** "closed"
- long and RTL names → `numberOfLines`, never a clipped layout

## Known gaps — do not paper over these

| Gap | Status |
|---|---|
| Typography | The board uses Arial/Georgia as PLACEHOLDERS. No licensed font yet. `theme.typography` deliberately sets no `fontFamily`. Do not substitute a lookalike. |
| Photography | One sprite sheet in the board; no production imagery. Fixture photos are flat colour tints. |
| Motion | The board defines **zero** transitions or keyframes. Any motion is an invention and must be flagged for review. |
| 440pt artboard | The board is authored at 440×956. The app re-flows rather than scaling. Expect 1–3px drift from the board. |
| Map view | Apple Maps via react-native-maps (bundled in Expo Go, no key). The board's illustrated basemap is not reproduced. |

## Commands

```
pnpm install            # at the repo root
pnpm start              # expo start
pnpm typecheck          # tsc --noEmit
pnpm lint
pnpm test               # jest across the workspace (mobile, contracts, API)
pnpm --filter @voya/api test:integration   # needs the local Supabase stack
pnpm --filter @voya/mobile env:local        # real-auth .env.local from the local stack
pnpm --filter @voya/mobile test:local-stack # app provider vs stack + running API
```

Backend setup (Supabase CLI is a project devDependency, not global): see
`docs/backend.md`.

If dependency versions conflict, run `npx expo install --fix` inside
`apps/mobile` — it realigns every package to the installed Expo SDK.

## Dev affordances

`app/dev.tsx` (Profile → Developer menu) switches seeded users (mock mode
only — never in real mode), toggles offline/error/latency simulation and
resets all mock data. It is `__DEV__`-gated and must never ship.

Mock verification code: **424242** (mock provider only). Real mode emails a
code; read it in Mailpit (http://127.0.0.1:54324). There is no universal bypass.
Real mode must never fall back to mock accounts or seeded identities.
