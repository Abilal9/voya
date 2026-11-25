import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceError } from '@/services/types';
import * as fx from './fixtures';
import { fixtureWeekOffset, shiftFixtureDates } from './clock';
import type { Account, ActivityEntry, Plan, SavedPlace, PlaceSignal, ID } from '@/services/types';

/**
 * Mock persistence.
 *
 * Everything the mock services mutate lives here, namespaced per account so two
 * seeded users never see each other's data. Backed by AsyncStorage so local
 * changes survive an app restart — which is what makes the demo honest.
 *
 * This file is the ONLY place that touches AsyncStorage. Screens and components
 * must never import it.
 */

// v2: fixture dates are week-shifted at seed time and Florence moved after the Wedding.
const VERSION = 'v2';
const key = (accountId: string, slice: string) => `voya:${VERSION}:${accountId}:${slice}`;
// The session is not versioned: a data reseed should not sign the user out.
const GLOBAL_SESSION_KEY = 'voya:session';
const LEGACY_SESSION_KEYS = ['voya:v1:session'];

export interface MockState {
  account: Account;
  plans: Plan[];
  saved: SavedPlace[];
  signals: Record<ID, PlaceSignal>;
  activity: ActivityEntry[];
}

/** Fresh state for an account, with fixture dates moved up to the current week. */
export function seed(accountId: string, now: number = Date.now()): MockState {
  const base = shiftFixtureDates(
    {
      account: fx.account,
      plans: fx.plans,
      saved: [] as SavedPlace[],
      signals: {} as Record<ID, PlaceSignal>,
      activity: fx.activity,
    },
    fixtureWeekOffset(now),
  ) as MockState;

  if (accountId !== fx.SIGNED_IN_ACCOUNT_ID) {
    // A second seeded identity: same world, different membership and no saves.
    const person = fx.people.find((p) => p.id === accountId) ?? fx.people[1]!;
    base.account = {
      ...person,
      email: `${person.firstName.toLowerCase()}@example.com`,
      onboardingStep: 'done',
      onboardingComplete: true,
      interests: ['Food', 'Activities'],
    };
    base.plans = base.plans.filter((p) => p.members.some((m) => m.personId === accountId));
    base.activity = [];
  }
  return base;
}

/** Deliberate latency / failure injection, driven by the dev menu. */
export const simulation = {
  latencyMs: 250,
  failNext: false,
  offline: false,
  emptyResults: false,
};

async function delay() {
  if (simulation.latencyMs > 0) {
    await new Promise((r) => setTimeout(r, simulation.latencyMs));
  }
  if (simulation.offline) {
    throw new ServiceError('offline', 'You appear to be offline.', true);
  }
  if (simulation.failNext) {
    simulation.failNext = false;
    throw new ServiceError('simulated', 'Simulated failure from the dev menu.', true);
  }
}

let cache: { accountId: string; state: MockState } | null = null;

export async function currentAccountId(): Promise<string | null> {
  const id = await AsyncStorage.getItem(GLOBAL_SESSION_KEY);
  if (id) return id;
  // One-time carry-over from the versioned key used before v2.
  for (const legacy of LEGACY_SESSION_KEYS) {
    const old = await AsyncStorage.getItem(legacy);
    if (old) {
      await AsyncStorage.setItem(GLOBAL_SESSION_KEY, old);
      await AsyncStorage.removeItem(legacy);
      return old;
    }
  }
  return null;
}

export async function setCurrentAccountId(id: string | null) {
  cache = null;
  if (id) await AsyncStorage.setItem(GLOBAL_SESSION_KEY, id);
  else await AsyncStorage.removeItem(GLOBAL_SESSION_KEY);
}

async function load(accountId: string): Promise<MockState> {
  if (cache?.accountId === accountId) return cache.state;
  const raw = await AsyncStorage.getItem(key(accountId, 'state'));
  const state: MockState = raw ? (JSON.parse(raw) as MockState) : seed(accountId);
  cache = { accountId, state };
  return state;
}

async function persist(accountId: string, state: MockState) {
  cache = { accountId, state };
  await AsyncStorage.setItem(key(accountId, 'state'), JSON.stringify(state));
}

/** Read the signed-in account's state, applying simulated latency/failure. */
export async function read(): Promise<{ accountId: string; state: MockState }> {
  await delay();
  const accountId = await currentAccountId();
  if (!accountId) throw new ServiceError('unauthenticated', 'No mock session.', false);
  return { accountId, state: await load(accountId) };
}

/** Read without latency — for synchronous-feeling lookups like `isSaved`. */
export async function peek(): Promise<{ accountId: string; state: MockState } | null> {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  return { accountId, state: await load(accountId) };
}

export async function mutate<T>(fn: (state: MockState) => T): Promise<T> {
  const { accountId, state } = await read();
  const next = structuredClone(state) as MockState;
  const result = fn(next);
  await persist(accountId, next);
  return result;
}

/** Dev menu: reset this account back to the seeded fixture graph. */
export async function resetAccount(accountId: string) {
  cache = null;
  await AsyncStorage.removeItem(key(accountId, 'state'));
}

export async function resetAll() {
  cache = null;
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter((k) => k.startsWith(`voya:${VERSION}:`) || k === GLOBAL_SESSION_KEY || LEGACY_SESSION_KEYS.includes(k)),
  );
}

export function bumpVersion(plan: Plan): Plan {
  plan.version += 1;
  return plan;
}
