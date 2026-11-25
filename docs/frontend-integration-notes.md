# Frontend → backend integration notes

What is simulated today, what has to become real, and what will *not* be a
drop-in swap. Written while building the mock frontend so the gaps are recorded
at the moment they were created rather than rediscovered later.

## The swap itself

`src/services/index.ts` is the composition root:

```ts
export const services: Services = mockServices;   // becomes apiServices
```

Everything in `src/services/contracts.ts` is designed to be satisfiable by a
generated NestJS client. Screens consume `useServices()` and nothing else, so the
swap should not touch a single screen.

**That claim holds for data. It does not hold for the five items below.**

## Will NOT be a drop-in swap

| Area | Why | Work required |
|---|---|---|
| **Apple / Google sign-in** | `signInWithApple()` currently resolves instantly. Real native auth needs signed development builds, nonce handling, cancellation paths and Apple private-relay emails. | A real spike on physical devices. Budget days, not hours. |
| **Universal / App Links** | There is no invitation URL handling at all yet — invites are resolved from in-memory tokens. Real links need live association files on the production domain and a cold/warm × installed/fresh-install test matrix. | The highest-risk integration in the product. |
| **Push notifications** | `NotificationsService` reads a local Activity list. Real push needs APNs/FCM credentials, device tokens, receipts and invalid-token handling. | Activity must stay durable and independent of delivery. |
| **Maps** | The map toggle currently switches to a list view and says so. Real `react-native-maps` needs restricted platform keys. | Keep the map UI provider-agnostic so the swap is contained. |
| **Place photos** | Fixture photos are flat colour tints. Real Google photos carry attribution requirements and cannot be cached. | `PlaceCard` must gain an attribution slot. |

## Contract notes for the API team (which is also you)

- **Optionality is already modelled.** `Place.rating`, `.price`, `.photo`,
  `.openNow` are all optional and the UI handles each absence distinctly.
  `openNow === undefined` renders "Hours unknown" — the API must not coerce
  unknown hours to `false`.
- **`version` is on every plan** and the mock bumps it on every mutation. The real
  API should use it for optimistic-concurrency preconditions; the UI already
  displays it on the plan detail screen during development.
- **`guestProjection()` strips host-only schedule items in the service layer**,
  not in the UI. The real API must strip them server-side too. Filtering in the
  client would be a disclosure bug.
- **Invitation acceptance is already idempotent** in the mock: a repeat returns
  `{ alreadyMember: true }` rather than throwing. The real transaction must match.
- **Capabilities, not roles.** `PlanMember.capabilities` is what the UI checks.
  Roles are labels for display.

## Deliberate design drift

The board is authored pixel-by-pixel at 440×956 and contains 132 distinct
colours, 27 font sizes, 29 radii and 50 spacing values. `src/theme/tokens.ts`
normalises these to coherent scales. **Expect 1–3px drift from the board in many
places.** This was a deliberate trade — a maintainable scale over literal
transcription — and it needs sign-off before the fidelity review.

If literal fidelity is required instead, that decision should be made now, not
after 96 screens are built.

## Blocked on decisions, not code

1. **Typography.** No licensed font files. `theme.typography` sets no
   `fontFamily`, so the app renders in the platform default. Pixel fidelity is
   unverifiable until this is resolved, and mobile app-binary embedding is a
   separate licence class.
2. **Photography.** No production imagery exists.
3. **Motion.** The board specifies none. The swipe deck's physics are an
   invention and need review.
4. **375pt layouts.** The densest screens (generated itinerary, host schedule
   editor, group progress) have not been drawn at small width.
