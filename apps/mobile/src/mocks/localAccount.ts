import type { Account, ID } from '@/services/types';
import { DEFAULT_SETTINGS } from './fixtures';
import { removePersonFromPlans } from './services';
import { deleteLocalAccount, linkAccount, linkedAccount, mutate, readWorld, setCurrentAccountId, writeWorld } from './store';

/**
 * The seam between the real auth/profile provider and the services that are
 * still mocked in B1 (plans, saved places, activity, Explore signals, per-plan
 * mutes). The composition root hands this to the real provider; screens never
 * see it. Removed piece by piece as each service moves to the API.
 */
export interface LocalAccountBridge {
  /** Real sign-in / restore: the mock services now act as this account, in its own namespace. */
  link(localId: string, account: Account): Promise<void>;
  /** Sign-out: the mock services have no identity until the next link. */
  unlink(): Promise<void>;
  /** Last profile stored on this phone for the account (offline cold start). */
  cached(localId: string): Promise<Account | null>;
  /** Account deleted: drop its local data and its place in local plans. */
  forget(localId: string): Promise<void>;
  /** H01 per-plan mutes (device-local until plans are served by the API). */
  mutedPlans(): Promise<ID[]>;
  setMutedPlans(ids: ID[]): Promise<ID[]>;
  /** V06 "Reset recommendation preferences": Explore's likes/skips are still local. */
  resetRecommendations(): Promise<void>;
}

export const localAccountBridge: LocalAccountBridge = {
  link: (localId, account) => linkAccount(localId, account),
  unlink: () => setCurrentAccountId(null),
  cached: (localId) => linkedAccount(localId),
  async forget(localId) {
    const world = await readWorld();
    await writeWorld({ ...world, plans: removePersonFromPlans(world.plans, localId) });
    await deleteLocalAccount(localId);
    await setCurrentAccountId(null);
  },
  mutedPlans: () => mutate((s) => [...(s.settings?.mutedPlans ?? [])]),
  setMutedPlans: (ids) =>
    mutate((s) => {
      s.settings = { ...(s.settings ?? structuredClone(DEFAULT_SETTINGS)), mutedPlans: [...ids] };
      return [...ids];
    }),
  resetRecommendations: () =>
    mutate((s) => {
      s.signals = {};
    }),
};
