import { FIXTURE_ANCHOR } from './fixtures';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TIMESTAMP_KEYS = new Set(['startsAt', 'endsAt', 'joinedAt', 'createdAt', 'readAt', 'savedAt', 'expiresAt']);

/**
 * Whole weeks between the fixture anchor and `now`. Never negative, so a clock
 * set before the anchor leaves fixtures exactly as authored.
 */
export function fixtureWeekOffset(now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(FIXTURE_ANCHOR)) / WEEK_MS));
}

function shiftIso(value: string, ms: number) {
  return new Date(Date.parse(value) + ms).toISOString();
}

function shiftDay(value: string, ms: number) {
  // Plain calendar dates ("2026-12-16"): shift at UTC noon to avoid DST edges.
  return new Date(Date.parse(`${value}T12:00:00Z`) + ms).toISOString().slice(0, 10);
}

/**
 * Returns a deep copy of `value` with every fixture timestamp moved forward by
 * `weeks` whole weeks. Keeps weekdays and times of day intact.
 */
export function shiftFixtureDates<T>(value: T, weeks: number): T {
  if (weeks === 0) return structuredClone(value);
  const ms = weeks * WEEK_MS;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && TIMESTAMP_KEYS.has(k)) out[k] = shiftIso(v, ms);
        else if (typeof v === 'string' && k === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = shiftDay(v, ms);
        else out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}
