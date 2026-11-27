import { Injectable } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import type { AuthContext } from '@voya/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * Maps a verified Supabase identity (`auth.users.id`) to the caller's Voya
 * profile, creating a minimal one on first use. Idempotent and race-safe: two
 * concurrent first requests resolve to the same row.
 *
 * B0 scope: the profile starts at onboarding step `profile` with a name taken
 * from the email; B1 fills it from sign-up and onboarding.
 */
@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveProfile(auth: AuthContext): Promise<Profile> {
    const name = nameFromEmail(auth.email);
    return this.prisma.profile.upsert({
      where: { authUserId: auth.authUserId },
      update: {},
      create: { authUserId: auth.authUserId, firstName: name, displayName: name },
    });
  }
}

export function nameFromEmail(email: string | undefined): string {
  const local = email?.split('@')[0]?.replace(/[._+-]+/g, ' ').trim();
  if (!local) return 'Voya member';
  return local.charAt(0).toUpperCase() + local.slice(1);
}
