# Voya

**Plan less. Live more.**

Voya is a premium social planning app with three experiences — **Trips**,
**Hangouts** and **Events** — over one journey: Discover → Decide → Plan → Go.
Navigation is **Home | Explore | Profile**, with a floating peach `+` to create a plan.

> **Everything is mocked.** This is the frontend-only phase. There is no backend,
> no Supabase, no Google Places/Routes and no real authentication. All data comes
> from local fixtures persisted to AsyncStorage. Nothing leaves the device.

## Stack

- Expo SDK 54 · Expo Router 6 · React Native 0.81.5 · React 19.1 · TypeScript (strict)
- TanStack Query, Zustand, React Hook Form + Zod
- Reanimated 4 + Gesture Handler for the Explore swipe deck
- pnpm workspace; the only app is `apps/mobile`

```
voya/
  apps/mobile/   Expo app (screens in app/, everything else in src/)
  reference/     Frozen design V1 and approved brand SVGs — read only
  docs/          Progress, screen inventory, mock data, integration notes
  AGENTS.md      Conventions for contributors and AI agents — read first
```

## Run it on the iOS Simulator

Prerequisites: Node 20, Xcode with an iOS simulator, and pnpm (via corepack).

```bash
corepack enable
pnpm install
cd apps/mobile
npx expo start --ios
```

If `xcode-select` points at the Command Line Tools instead of Xcode, either run
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` once, or prefix
the command with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

The app runs in **Expo Go for SDK 54**. If a simulator already has a different
Expo Go version, use another simulator rather than replacing it.

### Mock accounts

- Seeded users: Ahmad, Khaled, Omar, Faisal, Nisreen (`<firstname>@example.com`,
  any password of 6+ characters).
- Mock email verification code: **424242**.
- Profile → Developer menu (dev builds only) switches users, simulates
  offline/error/latency and resets all mock data.

### Checks

```bash
pnpm typecheck
pnpm lint
```

## Current status

Launched and checked on the iPhone 17 Pro simulator (iOS 26.5). Typecheck and
lint pass. Android has not been run, and there are no automated tests yet.

| Area | Status |
|---|---|
| Branding, splash, tab bar | Done |
| Home, Explore card deck, Saved, Profile, Past Plans, Create a Plan | Matched to the design board |
| Welcome, Sign in, Create account | Matched to the design board |
| Forgot/reset password, verify email, onboarding | Built earlier, not yet matched to the board |
| Explore search, filters, map, place details, Add to Plan | Not built (map waits for a provider) |
| Settings and profile sub-screens | Not built |
| Hangout, Event and Trip flows | Not built — plans open as read-only timelines |
| Invitations and Activity | Not built |

Detail lives in [`docs/frontend-progress.md`](docs/frontend-progress.md) and
[`docs/frontend-screen-inventory.md`](docs/frontend-screen-inventory.md).

## Design rules

The frozen design in `reference/voya-design-v1.html` is the source of truth.
Spacing, sizes and colours come from `apps/mobile/src/theme/tokens.ts` (the
`board` block holds exact values read from the design). Screens talk to
`useServices()` only, so the mock layer can later be swapped for the real API
without touching UI. See `AGENTS.md` for the full rules.
