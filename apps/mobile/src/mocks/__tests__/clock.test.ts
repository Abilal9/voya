import { fixtureWeekOffset, shiftFixtureDates } from '../clock';
import { FIXTURE_ANCHOR, fridayHangout } from '../fixtures';

describe('fixture clock', () => {
  it('never shifts backwards', () => {
    expect(fixtureWeekOffset(Date.parse('2026-01-01T00:00:00'))).toBe(0);
  });

  it('shifts by whole weeks so weekdays and times stay the same', () => {
    const weeks = fixtureWeekOffset(Date.parse(FIXTURE_ANCHOR) + 15 * 86400000);
    expect(weeks).toBe(2);
    const shifted = shiftFixtureDates(fridayHangout, weeks);
    const before = new Date(fridayHangout.startsAt!);
    const after = new Date(shifted.startsAt!);
    expect(after.getTime() - before.getTime()).toBe(14 * 86400000);
    expect(after.getDay()).toBe(before.getDay());
    expect(after.getHours()).toBe(before.getHours());
  });

  it('does not mutate the source fixtures', () => {
    const original = fridayHangout.startsAt;
    shiftFixtureDates(fridayHangout, 3);
    expect(fridayHangout.startsAt).toBe(original);
  });
});
