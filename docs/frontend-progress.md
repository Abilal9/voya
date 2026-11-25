# Frontend progress

Phases follow the agreed frontend plan. A phase is done when its gate passes —
not when files exist or TypeScript compiles.

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
| App launches with correct branding and navigation | ⚠️ Not verified — no simulator or device available in this environment |
| User can enter through the auth flows and return without repeating onboarding | ⚠️ Code complete, not device-verified |
| Primary navigation and common UI behave as designed | ⚠️ Code complete, not device-verified |
| Discover → save → revisit works on fixtures | ⚠️ Code complete, not device-verified |

**Nothing below has been run.** No `npm install`, no Metro bundler, no simulator,
no device. The environment this was built in has no package-registry access.
First run on a Mac is the real first test — see "First run" below.

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
