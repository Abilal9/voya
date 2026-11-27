import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { MeController } from './me.controller';

/** Users and identity mapping. Profiles and settings APIs arrive in B1. */
@Module({ controllers: [MeController], providers: [IdentityService], exports: [IdentityService] })
export class UsersModule {}
