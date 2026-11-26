# Frontend progress

A phase is done when its completion criteria pass — not when files exist or
TypeScript compiles. Item-level detail lives in `docs/product-backlog.md`.

## Roadmap (revised 2026-11-26)

| Phase | Scope | Status |
|---|---|---|
| F1 — Foundation | Main-only workflow, data consistency, fixture boundaries, tests, inventory, device verification | 🟡 Shared plan world (F1-10) done and tested; tap-through blocked on Simulator control |
| F2 — Auth & onboarding | A01–A12, separate mock accounts, resume, logout/restart | 🟡 Built and unit-tested; NOT simulator-verified (no tap control); dev test account added |
| F3 — Explore, Saved, Place details | E01–E12, Saved, map, Add to Plan | 🟡 All E01–E12 + Saved built and unit-tested; on-device tap review (F3-09) blocked on Simulator control |
| F4 — Profile & Settings | 03, V01–V13 | 🟡 All V01–V10, V13 built, screenshotted and unit-tested; on-device tap-through (F4-09) blocked |
| F5 — Hangouts | 13–17, 37, H01–H07 | 🟡 All 13 frames built on the shared mock plan; unit-tested across accounts and screenshotted; on-device tap-through (F5-09) blocked |
| **F6 — Events** | 18–24, 40, EV01–EV06 | ⬜ Next |
| F7 — Trips | 03–12, 35, 36, T01–T06 | ⬜ Not started |
| F8 — Invitations, Activity, states | 38, joins, S01–S09 | 🟡 Activity (38) built; rest pending |
| F9 — Validation & freeze | Full review, journeys, Android, dev build | ⬜ Not started |

Working rules: develop on `main` only, Conventional Commits with monorepo
scopes (see `AGENTS.md`), validate (`pnpm typecheck && pnpm lint && pnpm test`)
before every push.

## Earlier phase plan (historical)

| Phase | Scope | Status |
|---|---|---|
| 0 — Repository & design inspection | Repo verified, design parsed, tokens extracted, inventory recorded | ✅ Done |
| 1 — Expo foundation & branding | Workspace, Expo Router, icon, splash, tokens, primitives, mock-service conventions | ✅ Done |
| 2 — Mock auth & onboarding | Welcome, sign in/up, verify, reset, 4-step onboarding, session restore | ✅ Done |
| 3 — Main app shell | Tabs, Home, Profile, floating `+`, shared states | ✅ Done |
| 4 — Explore & Saved | Swipe deck, filters, place detail, saved, list view | 🟡 Partial — map view deferred, search screen deferred |
| 5 — Hangout flows | Create → invite → suggest → vote → finalise → timeline | ⬜ Not started |
| 6 — Event flows | Host/guest, RSVP, schedule editor, guest projection | ⬜ Not started |
| 7 — Trip flows | Preferences, Must Dos, fixture generation, itinerary editing | ⬜ Not started |
| 8 — Remaining screens & states | Activity, Past Plans, settings detail, invitations | ⬜ Not started |
| 9 — Review & freeze | Inventory vs implementation, device checks, integration contract | ⬜ Not started |

## Gate status

| Gate | Result |
|---|---|
| App launches with correct branding and navigation | ✅ Launched on iOS Simulator (iPhone 17 Pro, iOS 26.5, Expo Go 54.0.7), 2026-11-25 |
| User can enter through the auth flows and return without repeating onboarding | ⚠️ Screens render on device; flows not tapped through (checked by screenshot + deep link only) |
| Primary navigation and common UI behave as designed | ⚠️ Home, Explore, Profile, Create, Saved, Past Plans render and match the board; taps not exercised |
| Discover → save → revisit works on fixtures | ⚠️ Code path reviewed; not tapped through on device |

`pnpm install`, `pnpm typecheck` and `pnpm lint` all pass. Android has not been run.

**Matched to the board (spacing/sizes from board CSS, `board` in `src/theme/tokens.ts`):**
Home, Explore (E01), Saved (39), Profile (03), Create a Plan (02), Past Plans (V11),
Welcome (A01), Sign in (A03), Create account (A02), tab bar, Button, TextField.
Home and Welcome use the full logo at the emblem's former height (owner direction).

## Built in this slice

**Foundation**
- pnpm workspace, Expo Router app at `apps/mobile`, strict TypeScript, ESLint
- App icon, Android adaptive icon, splash and favicon generated from the approved
  emblem and lockup (cream splash `#FFF8EE`, lavender adaptive background)
- `reference/` copy of the frozen design with `CHECKSUMS.txt`

**Design system** — `src/theme/tokens.ts`
- Five exact brand colours; normalised colour, spacing, radius, type and shadow scales
- `VoyaEmblem` / `VoyaLogo` with path geometry copied verbatim from the approved SVGs

**Primitives** — `src/components/ui`
- Text, Screen, Button, TextField, Chip, Avatar, AvatarStack, Card, Divider,
  IconButton, Loading/Empty/Error/Offline states

**Service layer**
- 10 typed service contracts, mock implementations, AsyncStorage persistence
  namespaced per account, latency/error/offline injection

**Screens** — 28 of the board's 97 presentations

## First run (on the Mac, where there is a network)

```bash
cd ~/Desktop/projects/voya/voya
pnpm install
cd apps/mobile && npx expo install --fix     # aligns deps to the installed SDK
cd ../.. && pnpm typecheck                   # expect to fix a few version-drift errors
pnpm start
```

`npx expo install --fix` matters: the dependency versions in `package.json` were
written without registry access and are best-effort. That command rewrites them
to whatever the installed Expo SDK actually expects.

## Deferred, deliberately

- Map view (needs a provider) — the toggle currently switches to a list
- Search screen E10/E11 (list view covers the result state)
- Set-new-password screens A11/A12 (reset link has no destination in a mock)
- Activity screen 38 (Home shows the unread dot)
- All Hangout, Event and Trip flows — Phases 5–7
