import { queryClient } from '@/lib/queryClient';
import { mockServices } from '@/mocks/services';
import { resetAll, simulation } from '@/mocks/store';
import { useSession } from '../session';

beforeEach(async () => {
  simulation.latencyMs = 0;
  simulation.offline = false;
  simulation.failNext = false;
  await resetAll();
  queryClient.clear();
  useSession.setState({ status: 'booting', session: null, account: null, pendingInviteToken: null });
});

describe('session store keeps account data with its account', () => {
  it('empties the query cache on sign-out', async () => {
    await mockServices.auth.signIn('ahmad@example.com', 'x');
    await useSession.getState().boot();
    queryClient.setQueryData(['settings'], { private: true });
    await useSession.getState().signOut();
    expect(queryClient.getQueryData(['settings'])).toBeUndefined();
    expect(useSession.getState()).toMatchObject({ status: 'signed-out', account: null });
  });

  it('empties the query cache when a different account becomes current', async () => {
    await mockServices.auth.signIn('ahmad@example.com', 'x');
    await useSession.getState().boot();
    queryClient.setQueryData(['plans'], ['ahmad-only']);
    const khaled = await mockServices.auth.signIn('khaled@example.com', 'x');
    await useSession.getState().setSession(khaled);
    expect(useSession.getState().account?.firstName).toBe('Khaled');
    expect(queryClient.getQueryData(['plans'])).toBeUndefined();
  });

  it('keeps the cache when the same account refreshes', async () => {
    await mockServices.auth.signIn('ahmad@example.com', 'x');
    await useSession.getState().boot();
    queryClient.setQueryData(['plans'], ['mine']);
    await useSession.getState().refresh();
    expect(queryClient.getQueryData(['plans'])).toEqual(['mine']);
  });

  it('never stays on the blank boot screen when the account cannot be loaded', async () => {
    await mockServices.auth.signIn('ahmad@example.com', 'x');
    simulation.failNext = true;
    await useSession.getState().boot();
    expect(useSession.getState().status).toBe('signed-out');
  });
});
