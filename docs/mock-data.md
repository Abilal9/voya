# Mock data

One coherent fixture graph in `src/mocks/fixtures.ts`. People, places and plans
reference each other, so a person looks the same on every screen and a plan item
points at a real place.

## Seeded people

| id | Name | Used as |
|---|---|---|
| `p-ahmad` | Ahmad | The signed-in account by default |
| `p-khaled` | Khaled Kadri | Hangout participant, wedding guest (going) |
| `p-omar` | Omar Hassan | Hangout participant, wedding guest (going) |
| `p-faisal` | Faisal Ahmed | Hangout participant, wedding guest (maybe) |
| `p-nisreen` | Nisreen | Wedding co-host |

Switch between them in **Profile → Developer menu**. Each has isolated storage,
so Ahmad's saved places never appear under Khaled's account.

## Seeded plans

| Plan | Type | Detail |
|---|---|---|
| Florence | Trip | 18–22 Nov, 4 travellers, 2 generated days, Uffizi and Duomo locked as Must Dos |
| Friday Night | Hangout | 27 Nov 19:30, 4 suggestions across Dinner/Dessert, not yet finalised |
| Ahmad & Nisreen's Wedding | Event | 12 Dec, 4 guests, 5 schedule items — entrance at 23:15 guest-visible, one hosts-only item |
| Padel & Dinner | Hangout | Completed, appears under Past Plans |

The wedding's **23:15 bride & groom entrance** carries the subtitle "Please be
seated by 11:05 PM" and is `all_guests`. The 22:45 photographer briefing is
`hosts_only` and must never appear in `guestProjection()` — that pair exists
specifically to test host/guest separation.

## Places — and the damaged ones

19 places across Riyadh, Florence and Dubai. **Roughly 35% are deliberately
imperfect**, because real provider data is:

| id | What is wrong with it | Exercises |
|---|---|---|
| `somewhere` | No price, hours unknown | "Hours unknown" ≠ closed |
| `nofa-majlis` | No rating, no photo | Rating and photo placeholders |
| `ar-long` | 50-character Arabic name, no rating/price/photo | RTL text, truncation, every placeholder at once |
| `closed-cafe` | Permanently closed | Filtered out of discovery, shown in detail |
| `santo-spirito` | No rating, price or photo | Referenced by the Florence itinerary anyway |

If a new component renders a `Place`, test it against `ar-long` and
`nofa-majlis` before considering it done.

## Simulation controls

**Profile → Developer menu** (`__DEV__` only):

- Switch seeded user — signs in as that identity with isolated data
- Offline — every service call rejects with an offline error
- Fail next request — arms a single simulated failure
- Latency — toggles 250ms / 1200ms
- Reset all mock data — clears storage and returns to Welcome

## Verification code

**424242.** There is no universal bypass and no fake "any code works" path.

## Resetting

Developer menu → Reset all mock data, or delete and reinstall the app.
State lives under `AsyncStorage` keys prefixed `voya:v1:`.
