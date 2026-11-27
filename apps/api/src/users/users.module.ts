import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AvatarService } from './avatar.service';
import { IdentityService } from './identity.service';
import { MeController } from './me.controller';
import { ProfileService } from './profile.service';

/** Identity mapping, the caller's profile, preferences, photo and account lifecycle (B1). */
@Module({
  controllers: [MeController],
  providers: [IdentityService, ProfileService, AvatarService, AccountService],
  exports: [IdentityService],
})
export class UsersModule {}
