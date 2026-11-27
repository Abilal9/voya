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
];
