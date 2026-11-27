import { mockServices as services } from '@/mocks/services';
import { INVITE_TOKENS } from '@/mocks/fixtures';
import { fresh, open, press, pressLabel, screen, signedInAs, user, waitFor } from './helpers';

jest.setTimeout(60000);
beforeEach(fresh);

describe('authentication', () => {
  it('signs in from Welcome, restores the session, and rejects an unknown email', async () => {
    const r = open('/');
    await press('Sign in');
    await user().type(await screen.findByLabelText('Email'), 'nobody@example.com');
    await user().type(screen.getByLabelText('Password'), 'whatever');
    await press(/^Sign in$/);
    expect(await screen.findByText(/No account uses that email/)).toBeTruthy();

    await user().clear(screen.getByLabelText('Email'));
    await user().type(screen.getByLabelText('Email'), 'khaled@example.com');
    await press(/^Sign in$/);
    await waitFor(() => expect(r.getPathname()).toBe('/'));
    expect(await screen.findByText(/Good (morning|afternoon|evening), Khaled/)).toBeTruthy();
    r.unmount();

    // Relaunch: the session is restored, no sign-in screen.
    const again = open('/');
    expect(await screen.findByText(/Khaled/)).toBeTruthy();
    expect(again.getPathname()).toBe('/');
  });
});

describe('explore and saved', () => {
  it('saving a place shows the toast and the place in Saved', async () => {
    await signedInAs('khaled');
    open('/place/uffizi');
    await pressLabel('Save');
    expect(await screen.findByText('Saved for later.')).toBeTruthy();
    expect((await services.saved.list()).map((s) => s.placeId)).toContain('uffizi');
  });
});

describe('hangouts', () => {
  it('an invitee joins Friday Night from the invitation and lands in the lobby', async () => {
    await signedInAs('nisreen');
    await services.invitations.accept(INVITE_TOKENS.validHangout);
    open('/hangout/plan-friday');
    await press("I'm in");
    expect(await screen.findByText('Your hangout')).toBeTruthy();
    expect((await services.plans.get('plan-friday')).members.map((m) => m.personId)).toContain('p-nisreen');
  });
});

describe('events', () => {
  it('a pending guest answers Going and sees the confirmation, then the schedule', async () => {
    await signedInAs('faisal');
    open('/event/plan-wedding');
    await press('Going');
    expect(await screen.findByText(/You.re going!/)).toBeTruthy();
    await press('View schedule');
    expect(await screen.findByText('Schedule')).toBeTruthy();
    expect(screen.queryByText('Photographer briefing')).toBeNull();
  });
});

describe('trips', () => {
  it('creates a trip from destination and dates, and shows the creation confirmation', async () => {
    await signedInAs('ahmad');
    const r = open('/trip/new');
    await press('Florence');
    await press('Continue');
    await pressLabel('Next month');
    const days = await screen.findAllByRole('button', { name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), .*\b1[0-4]\b/ });
    await user().press(days[0]!);
    await user().press(days[days.length - 1]!);
    await press('Continue');
    expect(await screen.findByText('Florence is ready.')).toBeTruthy();
    await press('View trip');
    await waitFor(() => expect(r.getPathname()).toMatch(/^\/trip\/plan-/));
    expect(await screen.findByText('Continue planning')).toBeTruthy();
  });

  it('the organizer locks a stop and a rebuild keeps it', async () => {
    await signedInAs('ahmad');
    open('/trip/plan-florence/itinerary');
    await pressLabel(/09:00 Breakfast/);
    await pressLabel('Lock time');
    await waitFor(async () => {
      const t = await services.plans.get('plan-florence');
      expect(t.type === 'trip' && t.days[0]!.items.find((i) => i.id === 'it-1')?.locked).toBe(true);
    });
    const before = await services.plans.get('plan-florence');
    await services.trips.generateItinerary('plan-florence', { rebuild: true });
    const after = await services.plans.get('plan-florence');
    if (before.type !== 'trip' || after.type !== 'trip') throw new Error('trip');
    expect(after.days[0]!.items.find((i) => i.id === 'it-1')?.startsAt).toBe(before.days[0]!.items.find((i) => i.id === 'it-1')?.startsAt);
  });
});

describe('invitation continuation', () => {
  it('a signed-out person opens a trip invite, signs in, and comes back to it', async () => {
    const r = open(`/invite/${INVITE_TOKENS.validTrip}`);
    await waitFor(() => expect(r.getPathname()).toBe('/welcome'));
    await press('Sign in');
    await user().type(await screen.findByLabelText('Email'), 'nisreen@example.com');
    await user().type(screen.getByLabelText('Password'), 'xxxxxx');
    await press(/^Sign in$/);
    await waitFor(() => expect(r.getPathname()).toBe(`/invite/${INVITE_TOKENS.validTrip}`));
    expect(await screen.findByText('Open invitation')).toBeTruthy();
    await press('Open invitation');
    await press('Join trip');
    expect(await screen.findByText(/You.re in\./)).toBeTruthy();
    await press('Choose your preferences');
    expect(await screen.findByText(/What kind of trip/)).toBeTruthy();
  });
});
