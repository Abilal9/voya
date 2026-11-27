import { Injectable, Logger } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { removeFromAllPlans } from '../plans/plan-store';
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
 * Shared plans (B2): in the same transaction the person is first taken off
 * every plan (see `removePerson`): plans they own pass to the member who
 * joined next, their votes and trip inputs go, their suggestions stay
 * credited to a former member, and a plan with nobody left on it is
 * deleted. Links they created go with the profile.
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
    let plans = { updated: 0, deleted: 0 };
    await this.prisma.$transaction(async (tx) => {
      plans = await removeFromAllPlans(tx, profile.id);
      await tx.profile.delete({ where: { id: profile.id } });
      await tx.$executeRaw`DELETE FROM auth.users WHERE id = ${authUserId}::uuid`;
    }, { timeout: 30_000 });
    this.logger.log({ profileId: profile.id, plansUpdated: plans.updated, plansDeleted: plans.deleted }, 'account deleted');
    await this.avatars.removeOthers(profile.id, null);
  }
}
