# Voya — frozen design to React Native screen inventory

Generated from `reference/voya-design-v1.html` (SHA-256 `9fa34030…`).

**97 presentations** on the board = 96 screens/states + the App Icon preview.
They are NOT 97 React Native screens: many are state variants of one screen,

which is why the component families in `src/components/ui` and `src/features`
carry most of the weight.

**This slice covers 28 of 97 presentations.** The rest are Phases 5–8.

Status: `Not started` · `Implemented` (renders) · `Interactive` (does real mock work)
· `Visually reviewed` · `Tested` · `Deferred`.

## 00 Access

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `A01` | Welcome | app/(auth)/welcome.tsx | Implemented |
| `A02` | Create account | app/(auth)/sign-up.tsx | Implemented |
| `A03` | Sign in | app/(auth)/sign-in.tsx | Implemented |
| `A04` | Forgot password | app/(auth)/forgot-password.tsx | Implemented |
| `A05` | Reset link sent | app/(auth)/reset-sent.tsx | Implemented |
| `A06` | Verify email | app/(auth)/verify.tsx | Implemented |
| `A07` | Basic profile | app/(onboarding)/profile.tsx | Implemented |
| `A08` | Interests | app/(onboarding)/interests.tsx | Implemented |
| `A09` | Location permission | app/(onboarding)/location.tsx | Implemented |
| `A10` | Notification permission | app/(onboarding)/notifications.tsx | Implemented |
| `A11` | Set new password | app/(auth)/reset-sent.tsx | Deferred |
| `A12` | Password updated | app/(auth)/reset-sent.tsx | Deferred |

## 01 Profile & Settings

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `V01` | Edit profile | — | Not started |
| `V02` | Settings | — | Not started |
| `V03` | Account | — | Not started |
| `V04` | Notification settings | — | Not started |
| `V05` | Privacy & Safety | — | Not started |
| `V06` | Location & Discovery | — | Not started |
| `V07` | Help & Support | — | Not started |
| `V08` | About Voya | — | Not started |
| `V09` | Log out confirmation | — | Not started |
| `V10` | Delete account | — | Not started |
| `V11` | Past Plans | — | Not started |
| `V13` | Manage interests | — | Not started |

## 02 Explore

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `E01` | Card discovery ⭐ | app/(tabs)/explore.tsx | Interactive |
| `E02` | Location selection | app/(tabs)/explore.tsx (city chips) | Implemented |
| `E03` | Food filter selected | app/(tabs)/explore.tsx (category chips) | Implemented |
| `E04` | Swipe / like interaction | src/features/explore/SwipeDeck.tsx | Interactive |
| `E05` | Map view ⭐ | — | Not started |
| `E06` | Map marker + place preview | — | Not started |
| `E07` | Filters sheet | — | Not started |
| `E08` | Place details | app/place/[id].tsx | Interactive |
| `E09` | Add place to Plan | — | Not started |
| `E10` | Search places | — | Not started |
| `E11` | Search results | app/(tabs)/explore.tsx (list view) | Implemented |
| `E12` | No search results | components/ui/States.tsx EmptyState | Implemented |

## 03 Trip

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `T01` | Trip settings | — | Not started |
| `T02` | Edit trip details | — | Not started |
| `T03` | Manage travelers | — | Not started |
| `T04` | Share / invite to trip | — | Not started |
| `T05` | Completed trip | — | Not started |
| `T06` | Trip — Itinerary Map | — | Not started |

## 04 Hangout

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `H01` | Hangout settings | — | Not started |
| `H02` | Edit hangout | — | Not started |
| `H03` | Manage people | — | Not started |
| `H04` | Share hangout | — | Not started |
| `H05` | Hangout completed | — | Not started |
| `H06` | Hangout — Suggest a Place | — | Not started |
| `H07` | Hangout — Suggest a Change | — | Not started |

## 05 Event

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `EV01` | Event settings | — | Not started |
| `EV02` | Edit event details | — | Not started |
| `EV03` | Hosts & co-hosts | — | Not started |
| `EV04` | Share event | — | Not started |
| `EV05` | Event completed | — | Not started |
| `EV06` | Event — Add / Edit Schedule Item | — | Not started |

## 06 System states

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `S01` | Loading / skeleton | components/ui/States.tsx LoadingState | Implemented |
| `S02` | Empty state | components/ui/States.tsx EmptyState | Implemented |
| `S03` | Error state | components/ui/States.tsx ErrorState | Implemented |
| `S04` | Offline state | components/ui/States.tsx OfflineState | Implemented |
| `S05` | Permission denied | — | Not started |
| `S06` | Destructive confirmation | — | Not started |
| `S07` | Success popup | — | Not started |
| `S08` | Success toast | — | Not started |
| `S09` | Creation confirmation | — | Not started |

## Brand

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `Icon` | Voya — App Icon Preview | assets/icon.png | Implemented |

## — Core flows

| Code | Board caption | Route / component | Status |
|---|---|---|---|
| `41` | Voya — Splash Screen | app.json splash | Implemented |
| `01` | Home ⭐ | app/(tabs)/index.tsx | Interactive |
| `02` | Create a Plan | app/create.tsx | Interactive |
| `03` | Profile | app/(tabs)/profile.tsx | Interactive |
| `38` | Activity | app/(tabs)/profile.tsx | Deferred |
| `39` | Saved Places | app/saved.tsx | Interactive |
| `03` | Destination | app/(tabs)/profile.tsx | Interactive |
| `04` | Dates | — | Not started |
| `05` | Invite travelers | — | Not started |
| `06` | Preferences | — | Not started |
| `07` | Discover places | — | Not started |
| `08` | Group progress | — | Not started |
| `09` | Generated itinerary ⭐ | — | Not started |
| `10` | Activity controls | — | Not started |
| `11` | Replacement decision | — | Not started |
| `12` | Join trip | — | Not started |
| `35` | Trip — Overview | — | Not started |
| `36` | Trip — Today | — | Not started |
| `13` | Create Hangout | — | Not started |
| `14` | Choose together | — | Not started |
| `15` | Group suggestions | — | Not started |
| `16` | Final timeline ⭐ | — | Not started |
| `17` | Join Hangout | — | Not started |
| `37` | Hangout — Lobby | — | Not started |
| `18` | Create Event | — | Not started |
| `19` | Host Event page | — | Not started |
| `20` | Guest invitation ⭐ | — | Not started |
| `21` | Guest event details | — | Not started |
| `22` | Event schedule | — | Not started |
| `23` | Host schedule editor | — | Not started |
| `24` | RSVP confirmation | — | Not started |
| `40` | Event — Guests | — | Not started |
