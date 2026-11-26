# Voya — product backlog

The single list of everything needed to build and launch Voya. Frontend work
(F1–F9) is current; backend, admin, infrastructure and launch items are tracked
here so nothing is lost, but they are **not** current work.

- **Launch rule:** Voya V1 ships publicly with Trips, Hangouts **and** Events together.
- **Current phase:** frontend-only, everything mocked (see `AGENTS.md`).
- **Screen mapping:** `docs/frontend-screen-inventory.md`. **Phase status:** `docs/frontend-progress.md`.

**Priority** — P0 blocks startup, data integrity, core navigation or existing
critical behaviour · P1 essential for the complete approved frontend · P2
fidelity, edge cases, robustness before freeze · P3 later production
integration or enhancement.

**Status** — Not Started · In Progress · Implemented · Verified · Blocked · Deferred.
*Verified* means there is evidence (passing test, observed on device), not just code.

**Type** — `Mock` (frontend phase, simulated) · `Real` (needs backend/provider) · `Ops` (process, infra, launch).

---

## Frontend phases (current)

### F1 — Foundation cleanup, consistency and verification  ·  *active*

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F1-01 | All frontend work on `main`; single-branch workflow | P0 | Verified | Ops | — | — | `main` == `origin/main`, no force-push, old branch kept as history |
| F1-02 | Plan timing: past vs upcoming by date and lifecycle; fixtures week-shifted at seed | P0 | Verified | Mock | 01, V11 | — | Ended plans never appear as Up Next; seeded order Friday Night → Wedding → Florence (tests + simulator screenshot) |
| F1-03 | One headcount rule (event = invited guests; others = members) | P0 | Verified | Mock | 01, 19, 40 | — | Home and detail both show "4 guests" for the Wedding (tests + screenshot) |
| F1-04 | No fixture imports in screens; cities, interests, people via `catalog` service | P1 | Implemented | Mock | — | — | Only `app/dev.tsx` (dev-only) imports `src/mocks` |
| F1-05 | Home bell opens Activity (38) and clears the unread dot | P1 | Implemented | Mock | 38 | — | Bell routes to Activity; opening marks all read |
| F1-06 | Jest test foundation + regression suite | P0 | Verified | Mock | — | — | `pnpm test` covers sign-in, logout, restore, isolation, save/unsave, persistence, plan timing, headcount, reset |
| F1-07 | Session survives mock data reseeds (unversioned session key) | P1 | Implemented | Mock | — | F1-02 | Reseed does not sign the user out; reset still signs out |
| F1-08 | Tap-through verification of core screens on the simulator | P0 | Blocked | Ops | — | Simulator control | Welcome, Sign in, Home, Explore, Saved, Profile, Create, Logout exercised by real taps |
| F1-09 | Accurate screen coverage inventory | P1 | Implemented | Ops | all | — | Every board frame mapped with honest status |
| F1-10 | Shared mock world: one canonical record per plan, membership-based visibility, migration from per-account copies | P1 | Verified | Mock | 14–16, 19–24 | — | A vote cast as Ahmad is visible after switching to Khaled. Needed before F5 |
| F1-11 | Development-only test account (owner's email; password stored only as a SHA-256 digest; absent outside `__DEV__`) | P1 | Implemented | Mock | — | F2-04 | Signs in with the owner's password, starts at onboarding, sees seeded plans as Ahmad. Unit-tested with a fake account; not yet signed in on device |
| F1-12 | Back with no history (deep link, fresh launch) returns to the app root instead of throwing GO_BACK | P1 | Implemented | Mock | — | — | No unhandled GO_BACK in Metro logs |

### F2 — Authentication and onboarding

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F2-01 | Welcome, Sign in, Create account at board fidelity | P1 | Implemented | Mock | A01–A03 | — | Matches board; validation messages shown inline |
| F2-02 | Forgot password, Reset link sent, Verify email at board fidelity | P1 | Implemented | Mock | A04–A06 | F2-01 | Matches board; code 424242 verifies, wrong code errors |
| F2-03 | Set new password + Password updated | P1 | Implemented | Mock | A11–A12 | F2-02 | Reachable from reset flow; mismatch validation |
| F2-04 | Sign-up creates a separate local mock account (names persisted, no real password stored) | P1 | Implemented | Mock | A02, A07 | — | New account has empty saved/plans; seeded users untouched |
| F2-05 | Onboarding A07–A10 at board fidelity, resumable mid-way | P1 | Implemented | Mock | A07–A10 | F2-04 | Quit at A08, relaunch → resumes A08 |
| F2-06 | Mock Apple / Google sign-in journeys | P1 | Implemented | Mock | A02, A03 | — | Lands on correct next step; labelled as simulated |
| F2-07 | Returning-user and logout/restart journeys verified on device | P1 | Blocked | Mock | — | F1-08 (Simulator control) | Logout → Welcome; relaunch keeps session |

### F3 — Explore, Saved and Place details

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F3-01 | Card discovery, category filter, swipe/like | P1 | Implemented | Mock | E01, E03, E04 | — | Board-matched E01; like/skip/save work |
| F3-02 | Location selection sheet | P1 | Not Started | Mock | E02 | — | Replaces the temporary iOS action sheet |
| F3-03 | Filters sheet | P1 | Implemented | Mock | E07 | — | Filters change results; count badge |
| F3-04 | Search, results, no results | P1 | Implemented | Mock | E10–E12 | — | Search over mock catalogue |
| F3-05 | Map view + marker preview (mock-compatible map) | P1 | Not Started | Mock | E05, E06 | map library decision | Pins from fixture coordinates; card sync |
| F3-06 | Place details at board fidelity | P1 | Not Started | Mock | E08 | — | Handles missing rating/photo/hours |
| F3-07 | Add place to Plan | P1 | Not Started | Mock | E09 | F5/F7 models | Adds to an eligible plan, visible there |
| F3-08 | Saved places | P1 | Implemented | Mock | 39 | — | Board-matched; heart removes; city filter |

### F4 — Profile, Settings and Account

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F4-01 | Profile | P1 | Implemented | Mock | 03 | — | Board-matched; stats from real plan counts |
| F4-02 | Past Plans | P1 | Implemented | Mock | V11 | F1-02 | Filters by type; uses date classification |
| F4-03 | Edit profile + avatar | P1 | Not Started | Mock | V01 | — | Changes persist per account |
| F4-04 | Manage interests | P1 | Not Started | Mock | V13 | — | Changes Explore reasons |
| F4-05 | Settings hub + Account | P1 | Not Started | Mock | V02, V03 | — | Profile settings icon opens V02 |
| F4-06 | Notification, Privacy & Safety, Location & Discovery settings | P1 | Not Started | Mock | V04–V06 | F4-05 | Toggles persist |
| F4-07 | Help & Support, About | P2 | Not Started | Mock | V07, V08 | F4-05 | — |
| F4-08 | Log out confirmation + mock account deletion | P1 | Not Started | Mock | V09, V10 | F4-05 | Destructive confirm; other users unaffected |

### F5 — Hangouts

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F5-01 | Create Hangout (details, template, people) | P1 | Not Started | Mock | 13 | F1-10 | Creates a real mock hangout, not a placeholder draft |
| F5-02 | Lobby + manage people | P1 | Not Started | Mock | 37, H03 | F5-01 | — |
| F5-03 | Suggest a place / choose together | P1 | Not Started | Mock | H06, 14 | F3 catalogue | — |
| F5-04 | Group suggestions, voting, simulated participant votes | P1 | Not Started | Mock | 15 | F1-10 | Votes update counts for every member |
| F5-05 | Finalize + final timeline | P1 | Not Started | Mock | 16 | F5-04 | Only organizer can finalize |
| F5-06 | Suggest a change | P1 | Not Started | Mock | H07 | F5-05 | — |
| F5-07 | Settings, edit, share, completed | P1 | Not Started | Mock | H01, H02, H04, H05 | F5-01 | — |
| F5-08 | Join Hangout (from invite) | P1 | Not Started | Mock | 17 | F8-01 | — |

### F6 — Events

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F6-01 | Create Event (details, cover, venue) | P1 | Not Started | Mock | 18 | F1-10 | — |
| F6-02 | Host event page | P1 | Not Started | Mock | 19 | F6-01 | — |
| F6-03 | Guest invitation + guest event details | P1 | Not Started | Mock | 20, 21 | F6-02 | Host-only data never shown to guests |
| F6-04 | RSVP + confirmation | P1 | Not Started | Mock | 24 | F6-03 | RSVP updates guest list and counts |
| F6-05 | Guests list + hosts & co-hosts | P1 | Not Started | Mock | 40, EV03 | F6-02 | — |
| F6-06 | Schedule, host schedule editor, add/edit item | P1 | Not Started | Mock | 22, 23, EV06 | F6-02 | — |
| F6-07 | Settings, edit, share, completed | P1 | Not Started | Mock | EV01, EV02, EV04, EV05 | F6-02 | — |

### F7 — Trips

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F7-01 | Destination, dates, invite travelers | P1 | Not Started | Mock | 03–05 | F1-10 | — |
| F7-02 | Preferences, discover places, Must Dos | P1 | Not Started | Mock | 06, 07 | F7-01 | — |
| F7-03 | Group progress | P1 | Not Started | Mock | 08 | F7-02 | — |
| F7-04 | Mock generation + generated itinerary (multi-day) | P1 | Not Started | Mock | 09 | F7-03 | Deterministic fixture result, isolated for later swap |
| F7-05 | Activity controls, locks, replacement decision | P1 | Not Started | Mock | 10, 11 | F7-04 | Edits update the itinerary |
| F7-06 | Overview, Today, itinerary map, travel segments | P1 | Not Started | Mock | 35, 36, T06 | F7-04, F3-05 | — |
| F7-07 | Join trip | P1 | Not Started | Mock | 12 | F8-01 | — |
| F7-08 | Settings, edit, travelers, share, completed | P1 | Not Started | Mock | T01–T05 | F7-01 | — |

### F8 — Invitations, Activity and system states

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F8-01 | Invitation preview, join, already joined, expired/invalid, auth continuation | P1 | Not Started | Mock | 12, 17, 20 | — | Pending invite survives sign-in |
| F8-02 | Activity at full fidelity (actor avatars, plan context, deep links) | P2 | Implemented | Mock | 38 | F1-05 | — |
| F8-03 | System states: loading, empty, error, offline, permission denied | P1 | Not Started | Mock | S01–S05 | — | Board-matched shared components |
| F8-04 | Confirmation, success popup/toast, creation confirmation | P1 | Not Started | Mock | S06–S09 | — | — |

### F9 — Frontend validation and freeze

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| F9-01 | Full inventory + visual review against the board | P1 | Not Started | Ops | all | F2–F8 | Every frame mapped and checked |
| F9-02 | Journey tests: auth, explore, hangout, event, trip, settings, invitation | P1 | Not Started | Ops | — | F2–F8 | Real taps on device |
| F9-03 | Android pass | P2 | Not Started | Ops | — | — | Runs on an Android emulator |
| F9-04 | Accessibility pass (labels, sizes, contrast) | P2 | Not Started | Ops | — | — | — |
| F9-05 | Mock boundary review + backend integration backlog | P1 | Not Started | Ops | — | — | Swap is a change in `src/services/index.ts` only |
| F9-06 | Development build (not Expo Go) to verify native icon and splash | P2 | Not Started | Ops | Icon, 41 | — | — |

### Design system (cross-phase)

| ID | Item | P | Status | Type | Design | Depends | Acceptance |
|---|---|---|---|---|---|---|---|
| DS-01 | Licensed brand fonts (board uses Arial/Georgia placeholders) | P2 | Blocked | Ops | all | font licence | — |
| DS-02 | Production photography (fixtures use flat tints) | P2 | Blocked | Ops | all | imagery | — |
| DS-03 | Consolidate normalised tokens with exact `board` metrics | P2 | Not Started | Mock | all | — | One scale, no drift |
| DS-04 | Motion spec (board defines none; swipe motion is an invention) | P2 | Blocked | Ops | E04 | design decision | — |

---

## Backend and integration (later — not current work)

| ID | Item | P | Status | Type |
|---|---|---|---|---|
| BE-01 | NestJS modular monolith (`apps/api`) | P3 | Deferred | Real |
| BE-02 | PostgreSQL schema + Prisma migrations | P3 | Deferred | Real |
| BE-03 | Supabase Auth, JWT verification, session lifecycle | P3 | Deferred | Real |
| BE-04 | Real Apple / Google sign-in | P3 | Deferred | Real |
| BE-05 | Plans, membership and domain authorization | P3 | Deferred | Real |
| BE-06 | Invitation tokens, Universal Links / App Links (`voya.events/i/{token}`) | P3 | Deferred | Real |
| BE-07 | Private Realtime Broadcast for shared plans | P3 | Deferred | Real |
| BE-08 | Background jobs (pg-boss) | P3 | Deferred | Real |
| BE-09 | Google Places integration, cost controls, owned/licensed catalogue option | P3 | Deferred | Real |
| BE-10 | Google Routes for travel segments | P3 | Deferred | Real |
| BE-11 | Production itinerary scheduler | P3 | Deferred | Real |
| BE-12 | Email + push notifications, preferences | P3 | Deferred | Real |
| BE-13 | Storage for avatars and covers | P3 | Deferred | Real |
| BE-14 | Typed API client replacing mocks in `src/services/index.ts` | P3 | Deferred | Real |
| BE-15 | Authorization and security tests | P3 | Deferred | Real |

## Admin panel (later — Next.js, Voya APD)

| ID | Item | P | Status | Type |
|---|---|---|---|---|
| AD-01 | Admin auth with MFA and admin roles | P3 | Deferred | Real |
| AD-02 | User search, suspension, account actions | P3 | Deferred | Real |
| AD-03 | Content moderation and reports | P3 | Deferred | Real |
| AD-04 | Plan oversight, failed jobs, operational controls | P3 | Deferred | Real |
| AD-05 | Google usage monitoring | P3 | Deferred | Real |
| AD-06 | Audit log | P3 | Deferred | Real |

## Website and infrastructure (later)

| ID | Item | P | Status | Type |
|---|---|---|---|---|
| IN-01 | Public website `voya.events` on Cloudflare (repo `voya.events`) | P3 | Deferred | Ops |
| IN-02 | Railway: API, worker, admin; staging and production | P3 | Deferred | Ops |
| IN-03 | Supabase projects (staging, production) | P3 | Deferred | Ops |
| IN-04 | Domains: `api.`, `staging-api.`, `admin.voya.events` (to confirm) | P3 | Deferred | Ops |
| IN-05 | Expo EAS build profiles | P3 | Deferred | Ops |
| IN-06 | Secrets management | P3 | Deferred | Ops |
| IN-07 | Crash monitoring, logging, alerting | P3 | Deferred | Ops |
| IN-08 | Backup and restore | P3 | Deferred | Ops |

## Testing, security and quality

| ID | Item | P | Status | Type |
|---|---|---|---|---|
| QA-01 | Grow unit/integration tests with each slice | P1 | In Progress | Mock |
| QA-02 | Automated UI journeys on simulator | P2 | Not Started | Ops |
| QA-03 | Physical device testing (iOS + Android) | P2 | Not Started | Ops |
| QA-04 | Performance (swipe deck on mid-range Android) | P2 | Not Started | Ops |
| QA-05 | Privacy review | P3 | Deferred | Ops |

## Launch readiness

| ID | Item | P | Status | Type |
|---|---|---|---|---|
| LA-01 | Private alpha | P3 | Deferred | Ops |
| LA-02 | TestFlight beta | P3 | Deferred | Ops |
| LA-03 | Google Play testing track | P3 | Deferred | Ops |
| LA-04 | Store assets | P3 | Deferred | Ops |
| LA-05 | Privacy Policy and Terms | P3 | Deferred | Ops |
| LA-06 | Support channel | P3 | Deferred | Ops |
| LA-07 | Account deletion (store requirement) | P3 | Deferred | Real |
| LA-08 | Analytics | P3 | Deferred | Real |
| LA-09 | Public launch with Trips, Hangouts and Events together | P3 | Deferred | Ops |

## Explicitly deferred features

| ID | Item | Status |
|---|---|---|
| DF-01 | Payments | Deferred |
| DF-02 | Chat | Deferred |
| DF-03 | Public social feed | Deferred |
| DF-04 | Offline itineraries | Deferred |
