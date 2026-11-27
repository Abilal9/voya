import { create } from 'zustand';
import { queryClient } from '@/lib/queryClient';
import { services } from '@/services';
import { ServiceError, type Account, type AuthSession } from '@/services';

type Status = 'booting' | 'signed-out' | 'verifying' | 'onboarding' | 'ready';

/** Where an account belongs, from its own state — never from the last button pressed. */
export function statusFor(account: Account): Status {
  if (account.emailVerified === false) return 'verifying';
  return account.onboardingComplete ? 'ready' : 'onboarding';
}

interface SessionState {
  status: Status;
  session: AuthSession | null;
  account: Account | null;
  /** Survives sign-in and onboarding; consumed once membership is committed. */
  pendingInviteToken: string | null;

  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  setSession: (s: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  setPendingInvite: (token: string | null) => void;
}

const SIGNED_OUT = { status: 'signed-out' as const, session: null, account: null };
let watchingSession = false;

/**
 * Routing is derived from session + server onboarding state + pending intent —
 * never from which button the user happened to press.
 *
 * Account data never outlives its account: the query cache is cleared on
 * sign-out and whenever a different account becomes current, and a session
 * that ends on its own (revoked, expired, 401) drops straight to signed-out
 * so no private screen stays up.
 */
export const useSession = create<SessionState>((set, get) => {
  /** Applies a (possibly different) account; a change of account empties the cache first. */
  const apply = (session: AuthSession, account: Account) => {
    const previous = get().account;
    if (previous && previous.id !== account.id) queryClient.clear();
    set({ session, account, status: statusFor(account) });
  };

  const dropToSignedOut = () => {
    queryClient.clear();
    set({ ...SIGNED_OUT, pendingInviteToken: get().pendingInviteToken });
  };

  return {
    status: 'booting',
    session: null,
    account: null,
    pendingInviteToken: null,

    async boot() {
      if (!watchingSession && services.auth.onSessionEnded) {
        watchingSession = true;
        services.auth.onSessionEnded(() => {
          if (get().status !== 'signed-out') dropToSignedOut();
        });
      }
      try {
        const session = await services.auth.getSession();
        if (!session) {
          set(SIGNED_OUT);
          return;
        }
        apply(session, await services.profile.getAccount());
      } catch (e) {
        // No account could be loaded (signed out elsewhere, or nothing cached
        // and the server unreachable): never leave the app on a blank boot.
        if (!(e instanceof ServiceError) && __DEV__) console.warn('boot failed', e);
        dropToSignedOut();
      }
    },

    async refresh() {
      // Also picks up a session created outside the store (e.g. sign-up → verify).
      const session = (await services.auth.getSession()) ?? get().session;
      if (!session) return;
      apply(session, await services.profile.getAccount());
    },

    async setSession(session) {
      apply(session, await services.profile.getAccount());
    },

    async signOut() {
      await services.auth.signOut();
      queryClient.clear();
      set({ ...SIGNED_OUT, pendingInviteToken: null });
    },

    setPendingInvite(token) {
      set({ pendingInviteToken: token });
    },
  };
});
