import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceError } from '@/services/types';
import * as fx from './fixtures';
import { fixtureWeekOffset, shiftFixtureDates } from './clock';
import type { Account, AccountSettings, ActivityEntry, Plan, SavedPlace, PlaceSignal, ID, Trip } from '@/services/types';

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

/** What belongs to one account only. Never shared, never visible to others. */
export interface AccountState {
  account: Account;
  saved: SavedPlace[];
  signals: Record<ID, PlaceSignal>;
  activity: ActivityEntry[];
  /** Most recent first, at most 5. Optional so older stored state still loads. */
  recentSearches?: string[];
  /** Explore's chosen city, kept across launches; undefined = near me. */
  exploreCity?: string;
  /** Most recent first, at most 3 (E02 "Recent destinations"). */
  recentCities?: string[];
  /** V04–V06 preferences; optional so older stored state still loads. */
  settings?: AccountSettings;
}

/**
 * The shared mock world: ONE canonical record per plan. Membership lives on
 * the plan (`members`, and `guests` for events). Holding a record is not
 * permission to see it — services filter with `canSee` from planRules.
 */
export interface World {
  plans: Plan[];
  /** Fixture plan ids already seeded into this world, so new fixtures can be added once. */
  seededIds?: string[];
}

/**
 * The view services work with: the signed-in account's own state plus the
 * whole shared world. `plans` is the canonical list — services must filter it.
 */
export interface MockState extends AccountState {
  plans: Plan[];
}

/** Fresh per-account state, with fixture dates moved up to the current week. */
export function seed(accountId: string, now: number = Date.now()): AccountState {
  const base = shiftFixtureDates(
    {
      account: fx.account,
      saved: [] as SavedPlace[],
      signals: {} as Record<ID, PlaceSignal>,
      activity: fx.activity,
    },
    fixtureWeekOffset(now),
  ) as AccountState;
  base.recentSearches = [...fx.SEEDED_RECENT_SEARCHES];
  base.recentCities = [...fx.SEEDED_RECENT_CITIES];

  if (accountId !== fx.SIGNED_IN_ACCOUNT_ID) {
    // Another seeded identity: its own profile, no saves, no activity.
    const person = fx.people.find((p) => p.id === accountId) ?? fx.people[1]!;
    base.account = {
      ...person,
      email: `${person.firstName.toLowerCase()}@example.com`,
      onboardingStep: 'done',
      onboardingComplete: true,
      interests: ['Coffee', 'Padel'],
    };
    base.activity = [];
    base.recentSearches = [];
    base.recentCities = [];
  }
  return base;
}

/** The shared world as authored, dates moved up to the current week. */
export function seedWorld(now: number = Date.now()): World {
  return { plans: shiftFixtureDates(fx.plans, fixtureWeekOffset(now)), seededIds: fx.plans.map((p) => p.id) };
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

let cache: { accountId: string; state: AccountState } | null = null;

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

const WORLD_KEY = `voya:${VERSION}:world`;
let worldCache: World | null = null;

async function loadWorld(): Promise<World> {
  if (worldCache) return worldCache;
  const raw = await AsyncStorage.getItem(WORLD_KEY);
  worldCache = raw ? normalizeWorld(JSON.parse(raw) as World) : seedWorld();
  if (!raw) await AsyncStorage.setItem(WORLD_KEY, JSON.stringify(worldCache));
  return worldCache;
}

/**
 * Fills fields added after a world was stored (hangout invites, change
 * requests) and adds fixture plans introduced since it was seeded. A seeded
 * plan the user deleted is never brought back: seeded ids are remembered.
 */
export function normalizeWorld(world: World, now: number = Date.now()): World {
  const seeded = new Set(world.seededIds ?? fx.ORIGINAL_PLAN_IDS);
  const fresh = fx.plans.filter((p) => !seeded.has(p.id) && !world.plans.some((x) => x.id === p.id));
  if (fresh.length) world.plans.push(...shiftFixtureDates(fresh, fixtureWeekOffset(now)));
  world.seededIds = [...new Set([...seeded, ...fx.plans.map((p) => p.id)])];
  for (const plan of world.plans) {
    if (plan.type === 'trip') normalizeTrip(plan);
    if (plan.type === 'hangout') {
      plan.invites ??= plan.members
        .filter((m) => m.personId !== plan.ownerId)
        .map((m) => ({ personId: m.personId, status: 'in' as const, invitedBy: plan.ownerId, invitedAt: m.joinedAt }));
      plan.changeRequests ??= [];
    }
  }
  return world;
}

/** A zoned ISO time as the phone's local wall time ("YYYY-MM-DDTHH:MM:00"). */
function toWall(v: string) {
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) return v;
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/**
 * Trips stored before F7: dates come from startsAt/endsAt, times become wall
 * times, travelers become joined invites, and the new collections start
 * empty. The itinerary itself is kept as it was.
 */
function normalizeTrip(t: Trip) {
  if (!t.startDate && t.startsAt) t.startDate = toWall(t.startsAt).slice(0, 10);
  if (!t.endDate && t.endsAt) t.endDate = toWall(t.endsAt).slice(0, 10);
  t.invites ??= t.members.filter((m) => m.personId !== t.ownerId)
    .map((m) => ({ personId: m.personId, status: 'joined' as const, invitedBy: t.ownerId, invitedAt: m.joinedAt }));
  t.preferences ??= {};
  t.picks ??= {};
  t.doneChoosing ??= [];
  t.mustDoBy ??= {};
  for (const day of t.days) {
    for (const item of day.items) {
      item.startsAt = toWall(item.startsAt);
      if (item.endsAt) item.endsAt = toWall(item.endsAt);
    }
  }
  for (const m of t.members) {
    if (m.role === 'traveler' && !m.capabilities.includes('suggestion.create')) m.capabilities = [...m.capabilities, 'suggestion.create'];
    if (m.personId === t.ownerId && !m.capabilities.includes('timeline.finalize')) m.capabilities = [...m.capabilities, 'timeline.finalize', 'plan.edit'];
  }
}

async function saveWorld(world: World) {
  worldCache = world;
  await AsyncStorage.setItem(WORLD_KEY, JSON.stringify(world));
}

/**
 * Before shared plans, each account stored its own copy of every plan.
 * Fold those copies into the shared world once: plans the world does not have
 * (ones the user created) are added, and a copy with a newer version replaces
 * the world's record (the user's last edits win). Then the copy is dropped.
 */
export function mergeLegacyPlans(world: World, legacy: Plan[]): World {
  const plans = [...world.plans];
  for (const plan of legacy) {
    const i = plans.findIndex((p) => p.id === plan.id);
    if (i === -1) plans.push(plan);
    else if (plan.version > plans[i]!.version) plans[i] = plan;
  }
  return { ...world, plans };
}

async function load(accountId: string): Promise<AccountState> {
  if (cache?.accountId === accountId) return cache.state;
  const raw = await AsyncStorage.getItem(key(accountId, 'state'));
  let state: AccountState;
  if (!raw) {
    state = seed(accountId);
  } else {
    const parsed = JSON.parse(raw) as AccountState & { plans?: Plan[] };
    if (parsed.plans) {
      await saveWorld(mergeLegacyPlans(await loadWorld(), parsed.plans));
      delete parsed.plans;
      await AsyncStorage.setItem(key(accountId, 'state'), JSON.stringify(parsed));
    }
    state = parsed;
    // Fields added after this state was stored: take the seeded value for
    // seeded accounts (local accounts already start with their own).
    if (state.recentSearches === undefined || state.recentCities === undefined) {
      const seeded = fx.people.some((p) => p.id === accountId) ? seed(accountId) : undefined;
      state.recentSearches ??= seeded?.recentSearches ?? [];
      state.recentCities ??= seeded?.recentCities ?? [];
    }
  }
  cache = { accountId, state };
  return state;
}

async function persist(accountId: string, state: AccountState) {
  cache = { accountId, state };
  await AsyncStorage.setItem(key(accountId, 'state'), JSON.stringify(state));
}

async function view(accountId: string): Promise<MockState> {
  const own = await load(accountId);
  const world = await loadWorld();
  return { ...own, plans: world.plans };
}

/** Read the signed-in account's state and the shared world, with simulated latency/failure. */
export async function read(): Promise<{ accountId: string; state: MockState }> {
  await delay();
  const accountId = await currentAccountId();
  if (!accountId) throw new ServiceError('unauthenticated', 'No mock session.', false);
  return { accountId, state: await view(accountId) };
}

/** Read without latency — for synchronous-feeling lookups like `isSaved`. */
export async function peek(): Promise<{ accountId: string; state: MockState } | null> {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  return { accountId, state: await view(accountId) };
}

/** Applies `fn`, then writes the account's own slice and the shared world back separately. */
export async function mutate<T>(fn: (state: MockState) => T): Promise<T> {
  const { accountId, state } = await read();
  const next = structuredClone(state) as MockState;
  const result = fn(next);
  const { plans, ...own } = next;
  await persist(accountId, own);
  await saveWorld({ plans });
  return result;
}

// ---------------------------------------------------------- local accounts

const REGISTRY_KEY = `voya:${VERSION}:accounts`;

/** Locally created accounts: lower-cased email → account id. No passwords. */
export async function readAccountRegistry(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(REGISTRY_KEY);
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

export async function hasAccountState(accountId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key(accountId, 'state'))) !== null;
}

/** Registers a new local account with its own profile and no plans or saves. */
export async function createLocalAccount(account: Account) {
  const registry = await readAccountRegistry();
  registry[account.email.toLowerCase()] = account.id;
  await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  const state: AccountState = { account, saved: [], signals: {}, activity: [] };
  await AsyncStorage.setItem(key(account.id, 'state'), JSON.stringify(state));
  cache = null;
}

const DELETED_KEY = `voya:${VERSION}:deleted-people`;

/** Seeded identities whose mock account was deleted (dev reset restores them). */
export async function deletedPeople(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(DELETED_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function markPersonDeleted(personId: string) {
  const list = await deletedPeople();
  if (!list.includes(personId)) list.push(personId);
  await AsyncStorage.setItem(DELETED_KEY, JSON.stringify(list));
}

/** Replaces the shared world (used by account deletion's plan clean-up). */
export async function writeWorld(world: World) {
  await saveWorld(world);
}

export async function readWorld(): Promise<World> {
  return structuredClone(await loadWorld());
}

/** Removes a local account and its data (used when sign-up is abandoned). */
export async function deleteLocalAccount(accountId: string) {
  const registry = await readAccountRegistry();
  for (const [email, id] of Object.entries(registry)) if (id === accountId) delete registry[email];
  await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  await AsyncStorage.removeItem(key(accountId, 'state'));
  cache = null;
}

/** Dev menu: reset this account back to the seeded fixture graph. */
export async function resetAccount(accountId: string) {
  cache = null;
  await AsyncStorage.removeItem(key(accountId, 'state'));
}

/** Dev menu: reseed the shared plans only; accounts and the session stay. */
export async function resetWorld() {
  worldCache = null;
  await AsyncStorage.removeItem(WORLD_KEY);
}

export async function resetAll() {
  cache = null;
  worldCache = null;
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter((k) => k.startsWith(`voya:${VERSION}:`) || k === GLOBAL_SESSION_KEY || LEGACY_SESSION_KEYS.includes(k)),
  );
}

export function bumpVersion(plan: Plan): Plan {
  plan.version += 1;
  return plan;
}
