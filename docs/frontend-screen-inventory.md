# Voya — design to React Native screen inventory

Source: `reference/voya-design-v1.html` — 97 presentations (96 screens/states + the app icon).
They are not 97 React Native screens: many are variants, sheets or states of one screen.
Updated 2026-11-26 from the rendered board.

**Coverage:** 24 implemented · 8 partial · 65 missing (of 97).

**Columns.** *Implementation*: Implemented / Partial / Missing. *Interaction check*: how it was
checked — "Screenshot" means rendered on the iOS Simulator and inspected by screenshot or deep link
(no taps, Simulator control not granted yet); "unit tests" means the service behaviour behind it is
covered by `pnpm test`; "Not tested" means code only. *Visual*: "Board-matched" means spacing and sizes
were taken from the board CSS and compared side by side.

## Brand and startup

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `Icon` | App Icon Preview | Asset | assets/icon.png | Implemented | — | Not checked outside Expo Go | Verify in a dev build | F9-06 |
| `41` | Splash Screen | Screen | native splash (assets/splash-icon.png) | Implemented | — | Seen in Expo Go only | Verify in a dev build | F9-06 |

## Access (auth and onboarding)

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `A01` | Welcome | Screen | app/(auth)/welcome.tsx | Implemented | Screenshot | Board-matched | Full logo per owner direction | F2-01 |
| `A02` | Create account | Screen | app/(auth)/sign-up.tsx | Implemented | Screenshot + unit tests | Board-matched | | F2-01, F2-04 |
| `A03` | Sign in | Screen | app/(auth)/sign-in.tsx | Implemented | Screenshot + unit tests | Board-matched |  | F2-01 |
| `A04` | Forgot password | Screen | app/(auth)/forgot-password.tsx | Implemented | Screenshot | Board-matched | | F2-02 |
| `A05` | Reset link sent | Screen | app/(auth)/reset-sent.tsx | Implemented | Screenshot | Board-matched | Preview reset link opens A11, as on the board | F2-02 |
| `A06` | Verify email | Screen | app/(auth)/verify.tsx | Implemented | Unit tests | Built to board CSS; not yet seen on device | Needs a signed-up session to reach | F2-02 |
| `A07` | Basic profile | Screen | app/(onboarding)/profile.tsx | Implemented | Unit tests | Built to board CSS; not yet seen on device | Change photo waits for F4-03 | F2-05 |
| `A08` | Interests | Screen | app/(onboarding)/interests.tsx | Implemented | Unit tests | Built to board CSS; not yet seen on device | | F2-05 |
| `A09` | Location permission | Screen | app/(onboarding)/location.tsx | Implemented | Not tested | Built to board CSS; not yet seen on device | Mocked: no OS prompt | F2-05 |
| `A10` | Notification permission | Screen | app/(onboarding)/notifications.tsx | Implemented | Not tested | Built to board CSS; not yet seen on device | Mocked: no OS prompt | F2-05 |
| `A11` | Set new password | Screen | app/(auth)/set-password.tsx | Implemented | Screenshot + unit tests | Board-matched | | F2-03 |
| `A12` | Password updated | State | app/(auth)/password-updated.tsx | Implemented | Screenshot | Board-matched | | F2-03 |

## Home, Profile and Settings

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `01` | Home | Screen | app/(tabs)/index.tsx | Implemented | Screenshot + unit tests | Board-matched | Flat photo tints | F1-02 |
| `02` | Create a Plan | Screen | app/create.tsx | Implemented | Screenshot | Board-matched | Options create placeholder drafts until F5–F7 | F5-01, F6-01, F7-01 |
| `03` | Profile | Screen | app/(tabs)/profile.tsx | Implemented | Screenshot | Board-matched | Edit profile, Settings, Manage hidden until built | F4-01 |
| `38` | Activity | Screen | app/activity.tsx | Implemented | Screenshot | Close to board | Board day labels use Today/Yesterday | F1-05, F8-02 |
| `39` | Saved Places | Screen | app/saved.tsx | Implemented | Screenshot (empty state) + unit tests | Board-matched | Add to Plan missing | F3-08, F3-07 |
| `V01` | Edit profile | Screen | — | Missing | — | — |  | F4-03 |
| `V02` | Settings | Screen | — | Missing | — | — |  | F4-05 |
| `V03` | Account | Screen | — | Missing | — | — |  | F4-05 |
| `V04` | Notification settings | Screen | — | Missing | — | — |  | F4-06 |
| `V05` | Privacy & Safety | Screen | — | Missing | — | — |  | F4-06 |
| `V06` | Location & Discovery | Screen | — | Missing | — | — |  | F4-06 |
| `V07` | Help & Support | Screen | — | Missing | — | — |  | F4-07 |
| `V08` | About Voya | Screen | — | Missing | — | — |  | F4-07 |
| `V09` | Log out confirmation | Modal | — | Missing | — | — | Log out currently has no confirmation | F4-08 |
| `V10` | Delete account | Screen | — | Missing | — | — |  | F4-08 |
| `V11` | Past Plans | Screen | app/past-plans.tsx | Implemented | Screenshot | Board-matched |  | F4-02 |
| `V13` | Manage interests | Screen | — | Missing | — | — |  | F4-04 |

## Explore

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `E01` | Card discovery | Screen | app/(tabs)/explore.tsx | Implemented | Screenshot | Board-matched | Search and filter buttons hidden until built | F3-01 |
| `E02` | Location selection | Sheet | iOS action sheet (temporary) | Partial | Not tested | Not matched | Board sheet not built | F3-02 |
| `E03` | Food filter selected | Variant | app/(tabs)/explore.tsx (category selected) | Implemented | Not tested | Board-matched |  | F3-01 |
| `E04` | Swipe / like interaction | Variant | src/features/explore/SwipeDeck.tsx | Implemented | Not tested | Not matched | Swipe motion is not specified by the board | F3-01, DS-04 |
| `E05` | Map view | Screen | — | Missing | — | — | Map pill shows a list and says so | F3-05 |
| `E06` | Map marker + place preview | Variant | — | Missing | — | — |  | F3-05 |
| `E07` | Filters sheet | Sheet | — | Missing | — | — |  | F3-03 |
| `E08` | Place details | Screen | app/place/[id].tsx | Implemented | Not tested | Not matched | Restyle to board | F3-06 |
| `E09` | Add place to Plan | Sheet | — | Missing | — | — |  | F3-07 |
| `E10` | Search places | Screen | — | Missing | — | — |  | F3-04 |
| `E11` | Search results | Variant | — | Missing | — | — |  | F3-04 |
| `E12` | No search results | State | — | Missing | — | — |  | F3-04 |

## Trips

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `03` | Destination | Screen | — | Missing | — | — |  | F7-01 |
| `04` | Dates | Screen | — | Missing | — | — |  | F7-01 |
| `05` | Invite travelers | Screen | — | Missing | — | — |  | F7-01 |
| `06` | Preferences | Screen | — | Missing | — | — |  | F7-02 |
| `07` | Discover places | Screen | — | Missing | — | — |  | F7-02 |
| `08` | Group progress | Screen | — | Missing | — | — |  | F7-03 |
| `09` | Generated itinerary | Screen | — | Missing | — | — |  | F7-04 |
| `10` | Activity controls | Sheet | — | Missing | — | — |  | F7-05 |
| `11` | Replacement decision | Modal | — | Missing | — | — |  | F7-05 |
| `12` | Join trip | Screen | — | Missing | — | — |  | F7-07 |
| `35` | Trip — Overview | Screen | app/plan/[id].tsx (read-only timeline) | Partial | Screenshot | Not matched | Not grouped by day; no overview | F7-06 |
| `36` | Trip — Today | Screen | — | Missing | — | — |  | F7-06 |
| `T01` | Trip settings | Screen | — | Missing | — | — |  | F7-08 |
| `T02` | Edit trip details | Screen | — | Missing | — | — |  | F7-08 |
| `T03` | Manage travelers | Screen | — | Missing | — | — |  | F7-08 |
| `T04` | Share / invite to trip | Screen | — | Missing | — | — |  | F7-08 |
| `T05` | Completed trip | State | — | Missing | — | — |  | F7-08 |
| `T06` | Trip — Itinerary Map | Screen | — | Missing | — | — |  | F7-06 |

## Hangouts

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `13` | Create Hangout | Screen | — | Missing | — | — |  | F5-01 |
| `14` | Choose together | Screen | — | Missing | — | — |  | F5-03 |
| `15` | Group suggestions | Screen | — | Missing | — | — |  | F5-04 |
| `16` | Final timeline | Screen | app/plan/[id].tsx (read-only timeline) | Partial | Screenshot | Not matched | Not the board layout | F5-05 |
| `17` | Join Hangout | Screen | — | Missing | — | — |  | F5-08 |
| `37` | Hangout — Lobby | Screen | — | Missing | — | — |  | F5-02 |
| `H01` | Hangout settings | Screen | — | Missing | — | — |  | F5-07 |
| `H02` | Edit hangout | Screen | — | Missing | — | — |  | F5-07 |
| `H03` | Manage people | Screen | — | Missing | — | — |  | F5-02 |
| `H04` | Share hangout | Screen | — | Missing | — | — |  | F5-07 |
| `H05` | Hangout completed | State | — | Missing | — | — |  | F5-07 |
| `H06` | Hangout — Suggest a Place | Sheet | — | Missing | — | — |  | F5-03 |
| `H07` | Hangout — Suggest a Change | Sheet | — | Missing | — | — |  | F5-06 |

## Events

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `18` | Create Event | Screen | — | Missing | — | — |  | F6-01 |
| `19` | Host Event page | Screen | app/plan/[id].tsx (read-only schedule) | Partial | Screenshot | Not matched | No host controls | F6-02 |
| `20` | Guest invitation | Screen | — | Missing | — | — |  | F6-03 |
| `21` | Guest event details | Screen | — | Missing | — | — |  | F6-03 |
| `22` | Event schedule | Screen | — | Missing | — | — |  | F6-06 |
| `23` | Host schedule editor | Screen | — | Missing | — | — |  | F6-06 |
| `24` | RSVP confirmation | State | — | Missing | — | — |  | F6-04 |
| `40` | Event — Guests | Screen | — | Missing | — | — |  | F6-05 |
| `EV01` | Event settings | Screen | — | Missing | — | — |  | F6-07 |
| `EV02` | Edit event details | Screen | — | Missing | — | — |  | F6-07 |
| `EV03` | Hosts & co-hosts | Screen | — | Missing | — | — |  | F6-05 |
| `EV04` | Share event | Screen | — | Missing | — | — |  | F6-07 |
| `EV05` | Event completed | State | — | Missing | — | — |  | F6-07 |
| `EV06` | Event — Add / Edit Schedule Item | Sheet | — | Missing | — | — |  | F6-06 |

## Shared system states

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `S01` | Loading / skeleton | State | src/components/ui/States.tsx (LoadingState) | Partial | Not tested | Not matched | Restyle to board | F8-03 |
| `S02` | Empty state | State | src/components/ui/States.tsx (EmptyState) | Partial | Not tested | Not matched | Restyle to board | F8-03 |
| `S03` | Error state | State | src/components/ui/States.tsx (ErrorState) | Partial | Not tested | Not matched | Restyle to board | F8-03 |
| `S04` | Offline state | State | src/components/ui/States.tsx (OfflineState) | Partial | Not tested | Not matched | Restyle to board | F8-03 |
| `S05` | Permission denied | State | — | Missing | — | — |  | F8-03 |
| `S06` | Destructive confirmation | Modal | — | Missing | — | — |  | F8-04 |
| `S07` | Success popup | Modal | — | Missing | — | — |  | F8-04 |
| `S08` | Success toast | State | — | Missing | — | — |  | F8-04 |
| `S09` | Creation confirmation | State | — | Missing | — | — |  | F8-04 |
