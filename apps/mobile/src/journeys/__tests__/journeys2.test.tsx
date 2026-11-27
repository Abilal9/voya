import { mockServices as services } from '@/mocks/services';
import { simulation } from '@/mocks/store';
import { localDate } from '@/services/tripRules';
import { fresh, open, press, screen, signedInAs, user, waitFor } from './helpers';

jest.setTimeout(60000);
beforeEach(fresh);
const inDays = (n: number) => localDate(new Date(Date.now() + n * 86400000));

it('hangout: create from the form lands in the lobby', async () => {
  await signedInAs('ahmad');
  const r = open('/hangout/new');
  await press('Dinner');
  await press('Start planning');
  await waitFor(() => expect(r.getPathname()).toMatch(/^\/hangout\/plan-/));
  expect(await screen.findByText('Your hangout')).toBeTruthy();
});

it('hangout: once every slot has a voted place, the organizer finalizes and sees the timeline', async () => {
  await signedInAs('ahmad');
  const h = await services.plans.createHangout({ title: 'Thursday', city: 'Riyadh', template: 'Dinner', startsAt: new Date(Date.now() + 3 * 86400000).toISOString() });
  const s = await services.hangouts.suggestPlace(h.id, 'myazu', 'Dinner');
  await services.hangouts.vote(h.id, s.suggestions[0]!.id, 'up');
  open(`/hangout/${h.id}`);
  await press('Finalize plan');
  expect(await screen.findByText('Myazu')).toBeTruthy();
  const after = await services.plans.get(h.id);
  expect(after.type === 'hangout' && after.finalized).toBe(true);
});

it('event: host creates an event, opens settings and cancels it after confirming', async () => {
  await signedInAs('ahmad');
  const r = open('/event/new');
  await user().type(await screen.findByLabelText('Event name'), 'Sara’s Birthday');
  await user().type(screen.getByLabelText('Location'), 'Nofa Majlis');
  await press('Create event');
  await waitFor(() => expect(r.getPathname()).toMatch(/^\/event\/plan-/));
  expect(await screen.findByText('Manage Event')).toBeTruthy();
  await press('Manage Event');
  await press('Cancel event');
  await press('Keep event');
  await press('Cancel event');
  const buttons = await screen.findAllByText('Cancel event');
  await user().press(buttons[buttons.length - 1]!);
  expect(await screen.findByText('Event cancelled')).toBeTruthy();
});

it('trip: the organizer builds the itinerary from the group screen', async () => {
  await signedInAs('ahmad');
  const t = await services.trips.create({ destination: 'Florence', startDate: inDays(20), endDate: inDays(23) });
  const r = open(`/trip/${t.id}/group`);
  await press('Build our trip');
  await waitFor(() => expect(r.getPathname()).toBe(`/trip/${t.id}/itinerary`));
  expect(await screen.findByText('Day 1')).toBeTruthy();
  expect(await screen.findByText('Day 3')).toBeTruthy();
});

it('trip: a destination without enough places cannot be built, and says why', async () => {
  await signedInAs('ahmad');
  const t = await services.trips.create({ destination: 'Tokyo', startDate: inDays(20), endDate: inDays(23) });
  open(`/trip/${t.id}/group`);
  expect(await screen.findByText(/doesn.t have enough places in Tokyo/)).toBeTruthy();
});

it('log out asks first, then another account sees none of the first account’s saved places', async () => {
  await signedInAs('khaled');
  await services.saved.save('uffizi');
  const r = open('/settings');
  await press('Log out');
  await press('Cancel');
  expect(r.getPathname()).toBe('/settings');
  await press('Log out');
  const buttons = await screen.findAllByText('Log out');
  await user().press(buttons[buttons.length - 1]!);
  await waitFor(() => expect(r.getPathname()).toBe('/welcome'));
  await signedInAs('omar');
  expect((await services.saved.list()).map((s) => s.placeId)).not.toContain('uffizi');
});

it('offline: Home shows the offline state, and Try again recovers once back online', async () => {
  await signedInAs('ahmad');
  simulation.offline = true;
  open('/');
  expect(await screen.findByText(/You.re offline/, {}, { timeout: 5000 })).toBeTruthy(); // after the one automatic retry
  simulation.offline = false;
  await press('Try again');
  expect(await screen.findByText(/Good (morning|afternoon|evening), Ahmad/)).toBeTruthy();
});
