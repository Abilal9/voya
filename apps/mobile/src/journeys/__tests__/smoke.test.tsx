import { renderRouter, screen } from 'expo-router/testing-library';
import { simulation, resetAll } from '@/mocks/store';

jest.setTimeout(30000);

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

it('a signed-out launch lands on Welcome', async () => {
  renderRouter('./app', { initialUrl: '/' });
  expect(await screen.findByText(/Sign in/i)).toBeTruthy();
});
