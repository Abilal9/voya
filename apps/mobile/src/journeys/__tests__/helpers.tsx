import { renderRouter, screen, userEvent, waitFor } from 'expo-router/testing-library';
import { mockServices } from '@/mocks/services';
import { resetAll, simulation } from '@/mocks/store';
import { useSession } from '@/stores/session';

/**
 * Route-level journeys: the real screens, router, query cache and mock
 * services, rendered in Jest. They press buttons and type the way a person
 * would. They are NOT device tests: no native views, gestures or OS dialogs.
 */
export async function fresh() {
  simulation.latencyMs = 0;
  simulation.offline = false;
  simulation.failNext = false;
  await resetAll();
  useSession.setState({ status: 'booting', session: null, account: null, pendingInviteToken: null });
}

export async function signedInAs(who: string) {
  await mockServices.auth.signIn(`${who}@example.com`, 'x');
}

/** Renders the app at `url`. renderRouter switches to fake timers that start
 * from the real clock; carry the pinned test clock (jest.setup.js) over. */
export function open(url: string) {
  const now = Date.now();
  const r = renderRouter('./app', { initialUrl: url });
  jest.setSystemTime(now);
  return r;
}

export const user = () => userEvent.setup();
export { screen, waitFor };

export async function press(text: string | RegExp) {
  const el = await screen.findByText(text);
  await user().press(el);
}

export async function pressLabel(label: string | RegExp) {
  const el = await screen.findByLabelText(label);
  await user().press(el);
}
