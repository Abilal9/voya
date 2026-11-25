import { create } from 'zustand';
import { services } from '@/services';
import type { Account, AuthSession } from '@/services';

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

/**
 * Routing is derived from session + server onboarding state + pending intent —
 * never from which button the user happened to press. That is the same rule the
 * real auth coordinator will follow.
 */
export const useSession = create<SessionState>((set, get) => ({
  status: 'booting',
  session: null,
  account: null,
  pendingInviteToken: null,

  async boot() {
    const session = await services.auth.getSession();
    if (!session) {
      set({ status: 'signed-out', session: null, account: null });
      return;
    }
    const account = await services.profile.getAccount();
    set({ session, account, status: statusFor(account) });
  },

  async refresh() {
    // Also picks up a session created outside the store (e.g. sign-up → verify).
    const session = get().session ?? (await services.auth.getSession());
    if (!session) return;
    const account = await services.profile.getAccount();
    set({ session, account, status: statusFor(account) });
  },

  async setSession(session) {
    const account = await services.profile.getAccount();
    set({ session, account, status: statusFor(account) });
  },

  async signOut() {
    await services.auth.signOut();
    set({ status: 'signed-out', session: null, account: null, pendingInviteToken: null });
  },

  setPendingInvite(token) {
    set({ pendingInviteToken: token });
  },
}));
