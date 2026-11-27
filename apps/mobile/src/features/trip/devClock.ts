/**
 * Development-only test clock for Today (36). A seeded trip is rarely "on"
 * when you look at it, so `/dev?clock=2026-12-16T11:00` lets the simulator
 * show a trip day without touching any data or the real clock. It lives in
 * memory only and is ignored outside __DEV__.
 */
let override: number | null = null;

export function setTestClock(iso: string | null) {
  if (!__DEV__) return;
  const t = iso ? Date.parse(iso) : Number.NaN;
  override = Number.isNaN(t) ? null : t;
}

export function tripNow(): Date {
  return __DEV__ && override !== null ? new Date(override) : new Date();
}

export const testClockOn = () => __DEV__ && override !== null;
