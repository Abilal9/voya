import { Injectable } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import type { AuthContext } from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Maps a verified Supabase identity (`auth.users.id`) to the caller's Voya
 * profile, creating it on first use.
 *
 * A valid signature is not enough: before anything is read or created, the
 * auth user must still exist (not deleted or banned) and the token's session
 * must still be live. That makes sign-out, session revocation and account
 * deletion take effect at once instead of when the access token expires, and
 * it stops a leftover token from re-creating a deleted account's profile.
 *
 * Provisioning is idempotent and race-safe (one upsert on the unique
 * `auth_user_id`). It never links to a seeded demo person: those have no
 * `auth_user_id`, and nothing here matches by name or email.
 */
@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveProfile(auth: AuthContext): Promise<Profile> {
    await this.assertLive(auth);
    const names = initialNames(auth);
    return this.prisma.profile.upsert({
      where: { authUserId: auth.authUserId },
      update: {},
      create: { authUserId: auth.authUserId, ...names },
    });
  }

  /** The auth user and (when the token names one) its session still exist. 401 otherwise. */
  async assertLive(auth: AuthContext): Promise<void> {
    const sessionId = auth.sessionId ?? null;
    if (sessionId !== null && !UUID.test(sessionId)) throw AppError.unauthenticated();
    const [row] = await this.prisma.$queryRaw<{ user_ok: boolean; session_ok: boolean }[]>`
      SELECT
        EXISTS (
          SELECT 1 FROM auth.users u
          WHERE u.id = ${auth.authUserId}::uuid
            AND u.deleted_at IS NULL
            AND (u.banned_until IS NULL OR u.banned_until <= now())
        ) AS user_ok,
        (${sessionId}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM auth.sessions s
          WHERE s.id = ${sessionId}::uuid
            AND s.user_id = ${auth.authUserId}::uuid
            AND (s.not_after IS NULL OR s.not_after > now())
        )) AS session_ok`;
    if (!row?.user_ok || !row.session_ok) {
      throw AppError.unauthenticated('Your session has ended. Sign in again.');
    }
  }
}

/** First-login names: what was given at sign-up, else derived from the email. */
export function initialNames(auth: Pick<AuthContext, 'email' | 'signUpNames'>): {
  firstName: string;
  lastName: string | null;
  displayName: string;
} {
  const firstName = auth.signUpNames?.firstName ?? nameFromEmail(auth.email);
  const lastName = auth.signUpNames?.lastName ?? null;
  return { firstName, lastName, displayName: [firstName, lastName].filter(Boolean).join(' ') };
}

export function nameFromEmail(email: string | undefined): string {
  const local = email?.split('@')[0]?.replace(/[._+-]+/g, ' ').trim();
  if (!local) return 'Voya member';
  return local.charAt(0).toUpperCase() + local.slice(1);
}
