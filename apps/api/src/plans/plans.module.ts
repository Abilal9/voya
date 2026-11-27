import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { InvitationsService } from './invitations.service';
import { MembershipService } from './membership.service';
import { InvitationsController, PeopleController, PlansController } from './plans.controller';
import { PlansService } from './plans.service';

/** Plans, membership and invitations (B2). */
@Module({
  imports: [UsersModule],
  controllers: [PlansController, InvitationsController, PeopleController],
  providers: [PlansService, InvitationsService, MembershipService],
})
export class PlansModule {}
