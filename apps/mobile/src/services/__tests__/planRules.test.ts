import { classifyPlan, eventCounts, headcountLabel, sortUpcoming } from '../planRules';
import type { Plan, VoyaEvent } from '../types';
import { florenceTrip, fridayHangout, wedding, completedHangout } from '@/mocks/fixtures';

const at = (iso: string) => Date.parse(iso);

describe('classifyPlan', () => {
  it('treats an active plan whose dates have passed as past', () => {
    expect(classifyPlan(florenceTrip, at('2026-12-21T09:00:00'))).toBe('past');
  });

  it('keeps an active plan upcoming until it ends', () => {
    // Mid-trip is still "upcoming" (current), not past.
    expect(classifyPlan(florenceTrip, at('2026-12-17T09:00:00'))).toBe('upcoming');
  });

  it('uses the start time when a plan has no end', () => {
    expect(classifyPlan(fridayHangout, at('2026-11-26T09:00:00'))).toBe('upcoming');
    expect(classifyPlan(fridayHangout, at('2026-11-28T09:00:00'))).toBe('past');
  });

  it('treats completed and cancelled plans as past regardless of dates', () => {
    expect(classifyPlan(completedHangout, at('2020-01-01T00:00:00'))).toBe('past');
    const cancelled = { ...wedding, lifecycle: 'cancelled' } as Plan;
    expect(classifyPlan(cancelled, at('2020-01-01T00:00:00'))).toBe('past');
  });

  it('keeps undated drafts upcoming', () => {
    const draft = { ...fridayHangout, lifecycle: 'draft', startsAt: undefined, endsAt: undefined } as Plan;
    expect(classifyPlan(draft, at('2030-01-01T00:00:00'))).toBe('upcoming');
  });
});

describe('seeded order matches the board', () => {
  it('lists Friday Night, then the Wedding, then Florence', () => {
    const titles = [florenceTrip, wedding, fridayHangout].sort(sortUpcoming).map((p) => p.title);
    expect(titles).toEqual(['Friday Night', "Ahmad & Nisreen's Wedding", 'Florence']);
  });
});

describe('event headcount', () => {
  it('counts guests, not hosts, so Home and detail agree', () => {
    const counts = eventCounts(wedding as VoyaEvent);
    expect(counts).toEqual({ invited: 4, going: 2, hosts: 2 });
    expect(headcountLabel(wedding)).toBe('4 guests');
  });

  it('counts members for trips and hangouts', () => {
    expect(headcountLabel(florenceTrip)).toBe('4 people');
  });
});
