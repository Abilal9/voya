import { Injectable, Logger } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { AvatarService } from './avatar.service';

/**
 * Account deletion (V10), real mode.
 *
 * One transaction removes the Voya profile (its settings and activity go with
 * it by cascade) and the Supabase Auth user (its identities, sessions and
 * refresh tokens go with it by cascade), so there is never a login without a
 * profile or a profile without a login. Outstanding access tokens stop
 * working at once: IdentityService refuses any token whose user is gone.
 * Profile photos are removed from Storage afterwards (best effort; a
 * leftover object sits in a private folder nobody can sign for).
 *
 * B2 dependency: shared plans need an ownership hand-over and membership
 * policy before an account that owns or belongs to a plan can be removed.
 * Until then such an account is refused with `conflict` — nothing is
 * deleted half-way. In B1 real accounts cannot hold server plans yet.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
  ) {}

  async delete(profile: Profile): Promise<void> {
    if (!profile.authUserId) throw AppError.forbidden();
    const authUserId = profile.authUserId;
    await this.prisma.$transaction(async (tx) => {
      const [owned, memberships, invitations] = await Promise.all([
        tx.plan.count({ where: { ownerId: profile.id } }),
        tx.planMember.count({ where: { profileId: profile.id } }),
        tx.invitation.count({ where: { createdById: profile.id } }),
      ]);
      if (owned + memberships + invitations > 0) {
        throw new AppError(
          'conflict',
          'Accounts that are part of shared plans cannot be deleted yet. Leave or hand over your plans first.',
        );
      }
      await tx.profile.delete({ where: { id: profile.id } });
      await tx.$executeRaw`DELETE FROM auth.users WHERE id = ${authUserId}::uuid`;
    });
    this.logger.log({ profileId: profile.id }, 'account deleted');
    await this.avatars.removeOthers(profile.id, null);
  }
}
