import type { Account } from '@/services/types';

/**
 * Development-only test accounts, requested by the project owner for testing
 * auth and onboarding on the simulator. Only a SHA-256 digest of the password
 * is kept — never the password — and the list is empty outside __DEV__.
 *
 * `personId` is the identity used for plan membership: this account plans as
 * the seeded Ahmad (organizer of the seeded plans) while keeping its own
 * profile, saved places and onboarding state.
 */
export interface DevAccount {
  email: string;
  passwordSha256: string;
  account: Account;
}

/**
 * Written inline in the `__DEV__` branch (not as a separate constant) so the
 * minifier drops it: release bundles contain neither the email nor the digest.
 */
export const DEV_ACCOUNTS: DevAccount[] = __DEV__
  ? [
      {
        email: 'ahmad.anas.ab@gmail.com',
        passwordSha256: '8776f108e247ab1e2b323042c049c266407c81fbad41bde1e8dfc1bb66fd267e',
        account: {
          id: 'dev-ahmad',
          personId: 'p-ahmad',
          firstName: 'Ahmad',
          lastName: 'Bilal',
          displayName: 'Ahmad Anas Bilal',
          city: 'Riyadh',
          email: 'ahmad.anas.ab@gmail.com',
          emailVerified: true,
          // Starts at onboarding so that flow can be tested; completing it persists.
          onboardingStep: 'profile',
          onboardingComplete: false,
          interests: [],
        },
      },
    ]
  : [];

export function devAccountFor(email: string): DevAccount | undefined {
  return DEV_ACCOUNTS.find((d) => d.email === email.trim().toLowerCase());
}
