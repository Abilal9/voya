/**
 * Compile-time drift check: the shared contracts must describe exactly the
 * shapes the frozen mobile app already consumes. Type-checked only (never
 * built or shipped). If this fails, a contract and the mobile types disagree:
 * fix the contract, not the frozen app.
 */
import type * as Mobile from '../../../apps/mobile/src/services/types';
import type * as C from '../src';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

export type Checks = [
  Assert<Equal<C.PlanType, Mobile.PlanType>>,
  Assert<Equal<C.PlanLifecycle, Mobile.PlanLifecycle>>,
  Assert<Equal<C.PlanRole, Mobile.PlanRole>>,
  Assert<Equal<C.Capability, Mobile.Capability>>,
  Assert<Equal<C.PlaceCategory, Mobile.PlaceCategory>>,
  Assert<Equal<C.OnboardingStep, Mobile.OnboardingStep>>,
  Assert<Equal<C.Person, Mobile.Person>>,
  Assert<Equal<C.Place, Mobile.Place>>,
  Assert<Equal<C.PlanMember, Mobile.PlanMember>>,
  Assert<Equal<C.PlanBase, Mobile.PlanBase>>,
  Assert<Equal<C.NotificationKey, Mobile.NotificationKey>>,
  Assert<Equal<C.TimelineItem, Mobile.TimelineItem>>,
  Assert<Equal<C.TripPreferences, Mobile.TripPreferences>>,
  Assert<Equal<C.TripInvite, Mobile.TripInvite>>,
  Assert<Equal<C.TripItem, Mobile.TripItem>>,
  Assert<Equal<C.TripDay, Mobile.TripDay>>,
  Assert<Equal<C.Trip, Mobile.Trip>>,
  Assert<Equal<C.HangoutInvite, Mobile.HangoutInvite>>,
  Assert<Equal<C.Hangout, Mobile.Hangout>>,
  Assert<Equal<C.Rsvp, Mobile.RSVP>>,
  Assert<Equal<C.EventGuest, Mobile.EventGuest>>,
  Assert<Equal<C.EventScheduleItem, Mobile.EventScheduleItem>>,
  Assert<Equal<C.CohostPermissions, Mobile.CohostPermissions>>,
  Assert<Equal<C.VoyaEvent, Mobile.VoyaEvent>>,
  Assert<Equal<C.Plan, Mobile.Plan>>,
  Assert<Equal<C.Invitation, Mobile.Invitation>>,
  // Server-kept preferences are the app's settings minus per-plan mutes (membership state, see api/plans).
  Assert<Equal<C.AccountPreferences, Omit<Mobile.AccountSettings, 'mutedPlans'>>>,
];
