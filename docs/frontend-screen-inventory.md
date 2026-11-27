# Voya — design to React Native screen inventory

Source: `reference/voya-design-v1.html` — 97 presentations (96 screens/states + the app icon).
They are not 97 React Native screens: many are variants, sheets or states of one screen.
Updated 2026-11-26 from the rendered board.

**Coverage:** 97 implemented · 0 partial · 0 missing (of 97). Implemented is not the same as device-verified: no frame has had a real tap-through yet (F9).

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
| `A07` | Basic profile | Screen | app/(onboarding)/profile.tsx | Implemented | Unit tests | Built to board CSS | Change photo now included | F2-05 |
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
| `03` | Profile | Screen | app/(tabs)/profile.tsx | Implemented | Screenshot | Board-matched | | F4-01 |
| `38` | Activity | Screen | app/activity.tsx | Implemented | Screenshot | Close to board | Board day labels use Today/Yesterday | F1-05, F8-02 |
| `39` | Saved Places | Screen | app/saved.tsx | Implemented | Screenshot (empty state) + unit tests | Board-matched | | F3-08 |
| `V01` | Edit profile | Screen | app/edit-profile.tsx | Implemented | Screenshot + unit tests | Board-matched | Photo picker not tapped on device | F4-03 |
| `V02` | Settings | Screen | app/settings/index.tsx | Implemented | Screenshot | Board-matched | | F4-05 |
| `V03` | Account | Screen | app/settings/account.tsx | Implemented | Screenshot | Board-matched | Email change / security need real auth | F4-05, F4-10 |
| `V04` | Notification settings | Screen | app/settings/notifications.tsx | Implemented | Screenshot + unit tests | Board-matched | Preferences only; nothing delivered | F4-06 |
| `V05` | Privacy & Safety | Screen | app/settings/privacy.tsx | Implemented | Screenshot | Board-matched | Policy pages not published | F4-06, F4-10 |
| `V06` | Location & Discovery | Screen | app/settings/discovery.tsx | Implemented | Screenshot + unit tests | Board-matched | No device location read | F4-06 |
| `V07` | Help & Support | Screen | app/settings/help.tsx | Implemented | Screenshot | Board-matched | Help Center not published | F4-07, F4-10 |
| `V08` | About Voya | Screen | app/settings/about.tsx | Implemented | Screenshot | Board-matched | Shows real version 0.1.0 | F4-07 |
| `V09` | Log out confirmation | Sheet | app/settings/index.tsx (BottomSheet) | Implemented | Unit tests (session) | Built to board CSS; not opened on device | Needs a tap | F4-08 |
| `V10` | Delete account | Screen | app/settings/delete-account.tsx | Implemented | Screenshot + unit tests | Board-matched | | F4-08 |
| `V11` | Past Plans | Screen | app/past-plans.tsx | Implemented | Screenshot | Board-matched |  | F4-02 |
| `V13` | Manage interests | Screen | app/interests.tsx | Implemented | Screenshot + unit tests | Board-matched | | F4-04 |

## Explore

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `E01` | Card discovery | Screen | app/(tabs)/explore.tsx | Implemented | Screenshot + unit tests | Board-matched | Search and filter buttons added; map pending | F3-01, F3-03 |
| `E02` | Location selection | Screen | app/location.tsx | Implemented | Screenshot + unit tests | Board-matched | Near me is mocked (home city) | F3-02 |
| `E03` | Food filter selected | Variant | app/(tabs)/explore.tsx (category selected) | Implemented | Not tested | Board-matched |  | F3-01 |
| `E04` | Swipe / like interaction | Variant | src/features/explore/SwipeDeck.tsx | Implemented | Not tested | Not matched | Swipe motion is not specified by the board | F3-01, DS-04 |
| `E05` | Map view | Variant | src/features/explore/MapExplore.tsx (Explore map mode) | Implemented | Screenshot + unit tests | Close to board | OS map instead of the illustrated basemap | F3-05, F3-11 |
| `E06` | Map marker + place preview | Variant | MapExplore preview carousel | Implemented | Not tested on device | Built to board CSS | Needs a tap to open | F3-05 |
| `E07` | Filters sheet | Sheet | app/filters.tsx (modal) | Implemented | Unit tests | Built to board CSS; not yet seen on device | Distance measured from the mock city centre | F3-03 |
| `E08` | Place details | Screen | app/place/[id].tsx | Implemented | Screenshot + unit tests | Board-matched | Flat photo tints | F3-06 |
| `E09` | Add place to Plan | Sheet | app/add-to-plan/[id].tsx (modal) | Implemented | Screenshot + unit tests | Board-matched | | F3-07 |
| `E10` | Search places | Screen | app/search.tsx | Implemented | Unit tests | Built to board CSS; not yet seen on device | | F3-04 |
| `E11` | Search results | Variant | app/search.tsx (results) | Implemented | Unit tests | Built to board CSS; not yet seen on device | | F3-04 |
| `E12` | No search results | State | app/search.tsx (empty) | Implemented | Unit tests | Built to board CSS; not yet seen on device | | F3-04 |

## Trips

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `03` | Destination | Screen | app/trip/new.tsx (step 1) | Implemented | Screenshot + unit tests | Board-matched | Destination photo is a tint; tagline only on the board | F7-01 |
| `04` | Dates | Screen | app/trip/new.tsx (step 2) | Implemented | Unit tests | Board-matched in code | Not screenshotted (needs a tap to reach step 2) | F7-01 |
| `05` | Who's coming | Screen | app/trip/[id]/travelers.tsx | Implemented | Screenshot + unit tests | Board-matched | No invite code: codes don’t exist yet | F7-02 |
| `06` | Preferences | Screen | app/trip/[id]/preferences.tsx | Implemented | Screenshot + unit tests | Board-matched | Trip-only; account interests only pre-fill | F7-03 |
| `07` | Discover places | Screen | app/trip/[id]/discover.tsx | Implemented | Screenshot + unit tests | Board-matched | Deck = the destination’s fixture places (14 in Florence) | F7-03 |
| `08` | Group progress | Screen | app/trip/[id]/group.tsx | Implemented | Screenshot + unit tests | Board-matched | Readiness from real picks; generation via "Build our trip" | F7-04 |
| `09` | Generated itinerary | Screen | app/trip/[id]/itinerary.tsx | Implemented | Screenshot + unit tests | Board-matched | No walking times between stops (no routing); honest intro line | F7-05 |
| `10` | Activity controls | Sheet | app/trip/[id]/itinerary.tsx (sheet) | Implemented | Unit tests | Board-matched in code | Not screenshotted (needs a tap) | F7-06 |
| `11` | Replacement decision | Modal | app/trip/[id]/decision.tsx | Implemented | Screenshot + unit tests | Board-matched | No distances ("12 min away") shown | F7-07 |
| `12` | Join trip | Screen | app/trip/[id]/index.tsx (Join) | Implemented | Unit tests | Board-matched in code | Decline is in the "…" menu; not screenshotted (no pending invitee in local data) | F7-02 |
| `35` | Trip — Overview | Screen | app/trip/[id]/index.tsx (Overview) | Implemented | Screenshot + unit tests | Board-matched |  | F7-08 |
| `36` | Trip — Today | Screen | app/trip/[id]/today.tsx | Implemented | Screenshot (dev test clock) + unit tests | Board-matched | No walk time; dev-only test clock for screenshots | F7-08 |
| `T01` | Trip settings | Screen | app/trip/[id]/settings.tsx | Implemented | Screenshot + unit tests | Board-matched | Trip permissions opens an explanation (no switches on the board) | F7-09 |
| `T02` | Edit trip details | Screen | app/trip/[id]/edit.tsx | Implemented | Screenshot + unit tests | Board-matched | Destination locked once the itinerary exists | F7-09 |
| `T03` | Manage travelers | Screen | app/trip/[id]/people.tsx | Implemented | Screenshot + unit tests | Board-matched |  | F7-09 |
| `T04` | Share / invite to trip | Sheet | src/features/trip/InviteSheet.tsx | Implemented | Code only | Board-matched in code | No invite code; Copy invite code shows "Available when invite codes go live" | F7-09 |
| `T05` | Completed trip | State | app/trip/[id]/index.tsx (Completed) | Implemented | Screenshot + unit tests | Board-matched |  | F7-09 |
| `T06` | Trip — Itinerary Map | Screen | app/trip/[id]/map.tsx | Implemented | Screenshot + unit tests | Board-matched | Apple Maps, not the illustrated basemap; dashed line is order, not a route | F7-08 |

## Hangouts

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `13` | Create Hangout | Screen | app/hangout/new.tsx | Implemented | Screenshot + unit tests | Board-matched | Date/time and destination open native pickers in sheets | F5-01 |
| `14` | Choose together | Screen | app/hangout/[id]/choose.tsx | Implemented | Screenshot + unit tests | Board-matched | Fixture photos are tints; deck shows the slot’s suggestions first | F5-03 |
| `15` | Group suggestions | Screen | app/hangout/[id]/suggestions.tsx | Implemented | Screenshot + unit tests | Board-matched |  | F5-04 |
| `16` | Final timeline | Screen | app/hangout/[id]/index.tsx (Final) | Implemented | Unit tests | Board-matched in code | No drive times shown (no routing data); not screenshotted (seed has no finalized upcoming hangout) | F5-05 |
| `17` | Join Hangout | Screen | app/hangout/[id]/index.tsx (Invitation) | Implemented | Unit tests | Board-matched in code | Shown to pending invitees; not screenshotted as Ahmad | F5-08 |
| `37` | Hangout — Lobby | Screen | app/hangout/[id]/index.tsx (Lobby) | Implemented | Screenshot + unit tests | Board-matched | Organizer sees “Finalize plan” once every slot has a voted place (board has no explicit control) | F5-02 |
| `H01` | Hangout settings | Screen | app/hangout/[id]/settings.tsx | Implemented | Screenshot + unit tests | Board-matched | Per-hangout mute stored in account settings | F5-07 |
| `H02` | Edit hangout | Screen | app/hangout/[id]/edit.tsx | Implemented | Screenshot + unit tests | Board-matched | Template locked once final | F5-07 |
| `H03` | Manage people | Screen | app/hangout/[id]/people.tsx | Implemented | Screenshot + unit tests | Board-matched | Initials are first+last (KK), board shows KH | F5-02 |
| `H04` | Share hangout | Sheet | app/hangout/[id]/settings.tsx (share sheet) | Implemented | Code only | Board-matched in code | OS share of plan details; Copy link shows “Available when invite links go live” | F5-07 |
| `H05` | Hangout completed | State | app/hangout/[id]/index.tsx (Completed) | Implemented | Screenshot | Board-matched | Cover is a tint (no photography) | F5-07 |
| `H06` | Hangout — Suggest a Place | Screen | app/hangout/[id]/suggest.tsx | Implemented | Screenshot + unit tests | Board-matched |  | F5-03 |
| `H07` | Hangout — Suggest a Change | Sheet | app/hangout/[id]/change.tsx (form sheet) | Implemented | Screenshot + unit tests | Board-matched | Slot picker is a segment, board shows a select | F5-06 |

## Events

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `18` | Create Event | Screen | app/event/new.tsx | Implemented | Screenshot + unit tests | Board-matched | Cover copied to app storage; no end time unless set | F6-01 |
| `19` | Host Event page | Screen | app/event/[id]/index.tsx (host) | Implemented | Screenshot + unit tests | Board-matched | Host-only schedule items shown with a "Hosts only" label | F6-02 |
| `20` | Guest invitation | Screen | app/event/[id]/index.tsx (invitation), app/event/[id]/invitation.tsx | Implemented | Screenshot (host preview) + unit tests | Board-matched | Back button over the cover (board has none); serif placeholder font not used (no licensed font) | F6-03 |
| `21` | Guest event details | Screen | app/event/[id]/index.tsx (guest) | Implemented | Screenshot (as Khaled) + unit tests | Board-matched | Guests tab shows counts only, never names | F6-03 |
| `22` | Event schedule | Screen | app/event/[id]/schedule.tsx | Implemented | Screenshot (host and guest) + unit tests | Board-matched |  | F6-06 |
| `23` | Host schedule editor | Screen | app/event/[id]/schedule-edit.tsx | Implemented | Screenshot + unit tests | Board-matched | No drag handles: items are ordered by start time | F6-06 |
| `24` | RSVP confirmation | State | app/event/[id]/going.tsx | Implemented | Screenshot (as Khaled) | Board-matched | Add to calendar opens the iOS calendar sheet; success only if saved there | F6-04 |
| `40` | Event — Guests | Screen | app/event/[id]/guests.tsx | Implemented | Screenshot + unit tests | Board-matched | "All guests" opens a status filter | F6-05 |
| `EV01` | Event settings | Screen | app/event/[id]/settings.tsx | Implemented | Screenshot + unit tests | Board-matched | Rows follow the viewer's permissions | F6-07 |
| `EV02` | Edit event details | Screen | app/event/[id]/edit.tsx | Implemented | Screenshot + unit tests | Board-matched | Dress code / Important note have no edit path on the board | F6-07 |
| `EV03` | Hosts & co-hosts | Screen | app/event/[id]/hosts.tsx | Implemented | Screenshot + unit tests | Board-matched |  | F6-05 |
| `EV04` | Share event | Sheet | app/event/[id]/settings.tsx (share sheet) | Implemented | Code only | Board-matched in code | Copy link shows "Available when invite links go live" | F6-07 |
| `EV05` | Event completed | State | app/event/[id]/index.tsx (closed) | Implemented | Screenshot (as guest) + unit tests | Board-matched | Also renders the cancelled state | F6-07 |
| `EV06` | Event — Add / Edit Schedule Item | Sheet | app/event/[id]/schedule-edit.tsx (item sheet) | Implemented | Unit tests | Board-matched in code | Not screenshotted (needs a tap) | F6-06 |

## Shared system states

| Code | Board caption | Kind | Route / component | Implementation | Interaction check | Visual | Gap | Backlog |
|---|---|---|---|---|---|---|---|---|
| `S01` | Loading / skeleton | State | src/components/ui/States.tsx (LoadingState; compact spinner for sheets) | Implemented | Screenshot (dev latency) | Board-matched |  | F8-01 |
| `S02` | Empty state | State | src/components/ui/States.tsx (EmptyState) in Home, Saved, Past Plans, Activity, Explore, invites | Implemented | Screenshot (Saved, invalid invite) | Board-matched | Actions only render when they do something | F8-02 |
| `S03` | Error state | State | src/components/ui/States.tsx (ErrorState: Try again, Go back) | Implemented | Unit tests | Board-matched in code | Shares the S04 frame; not screenshotted on its own | F8-03 |
| `S04` | Offline state | State | src/components/ui/States.tsx (OfflineState), shown for the mock "offline" error | Implemented | Screenshot (dev offline) + unit tests | Board-matched | No real network detection: simulated from the developer menu only | F8-04 |
| `S05` | Permission denied | State | States.tsx (PermissionState) + src/features/permissions/PhotoAccess.tsx | Implemented | Code only | Board-matched in code | Used for photo access (the only real OS permission); location is still mocked | F8-05 |
| `S06` | Destructive confirmation | Modal | src/features/feedback/Sheets.tsx (ConfirmSheet) + existing confirmation sheets | Implemented | Code only | Board-matched in code | Needs a tap to open | F8-06 |
| `S07` | Success popup | Modal | src/features/feedback/Sheets.tsx (SuccessSheet): "You’re in." after joining a trip | Implemented | Code only | Board-matched in code | Needs a tap to open | F8-06 |
| `S08` | Success toast | State | src/components/ui/Toast.tsx: "Saved for later." / "Removed from Saved." | Implemented | Code only | Board-matched in code | Needs a tap to show | F8-06 |
| `S09` | Creation confirmation | State | SuccessSheet after creating a trip: "Florence is ready." | Implemented | Code only | Board-matched in code | Needs a tap to open | F8-06 |
