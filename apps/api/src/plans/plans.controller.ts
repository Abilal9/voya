import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  type AcceptInvitationResponse,
  CreateEventRequestSchema,
  CreateHangoutRequestSchema,
  CreateInvitationRequestSchema,
  CreateTripRequestSchema,
  InvitationTokenRequestSchema,
  InvitePeopleRequestSchema,
  RespondToInvitationRequestSchema,
  TransferOwnershipRequestSchema,
  UpdatePlanRequestSchema,
  type RespondToInvitationResponse,
  ListPlansQuerySchema,
  MutePlanRequestSchema,
  type AuthContext,
  type CreatedInvitation,
  type Invitation,
  type InvitationSummary,
  type MutedPlans,
  type PeopleList,
  type Plan,
  type PlansList,
} from '@voya/contracts';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AppError } from '../common/errors/app-error';
import { zodDto } from '../common/validation/zod';
import { IdentityService } from '../users/identity.service';
import { InvitationsService } from './invitations.service';
import { MembershipService } from './membership.service';
import { PlansService } from './plans.service';

class ListPlansQueryDto extends zodDto(ListPlansQuerySchema) {}
class CreateHangoutDto extends zodDto(CreateHangoutRequestSchema) {}
class CreateEventDto extends zodDto(CreateEventRequestSchema) {}
class CreateTripDto extends zodDto(CreateTripRequestSchema) {}
class MutePlanDto extends zodDto(MutePlanRequestSchema) {}
class CreateInvitationDto extends zodDto(CreateInvitationRequestSchema) {}
class InvitationTokenDto extends zodDto(InvitationTokenRequestSchema) {}
class UpdatePlanDto extends zodDto(UpdatePlanRequestSchema) {}
class InvitePeopleDto extends zodDto(InvitePeopleRequestSchema) {}
class RespondDto extends zodDto(RespondToInvitationRequestSchema) {}
class TransferOwnershipDto extends zodDto(TransferOwnershipRequestSchema) {}

/**
 * `If-Match: <version>` (optionally quoted or weak) is the optimistic
 * concurrency precondition for destructive plan writes; without it the write
 * applies to the current version.
 */
export function parseIfMatch(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '' || value.trim() === '*') return undefined;
  const match = /^(?:W\/)?"?(\d{1,9})"?$/.exec(value.trim());
  if (!match) {
    throw new AppError('validation_failed', 'Some of the details are not valid.', [
      { path: 'header.if-match', message: 'Expected the plan version' },
    ]);
  }
  return Number(match[1]);
}

/** Plans the caller is on (B2). Ids in paths are plan ids; the caller always comes from the token. */
@Controller({ path: 'plans', version: '1' })
export class PlansController {
  constructor(
    private readonly identity: IdentityService,
    private readonly plans: PlansService,
    private readonly invitations: InvitationsService,
    private readonly membership: MembershipService,
  ) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext, @Query() query: ListPlansQueryDto): Promise<PlansList> {
    return { items: await this.plans.list(await this.identity.resolveProfile(auth), query.timing) };
  }

  @Post('hangouts')
  async createHangout(@CurrentAuth() auth: AuthContext, @Body() body: CreateHangoutDto): Promise<Plan> {
    return this.plans.createHangout(await this.identity.resolveProfile(auth), body);
  }

  @Post('events')
  async createEvent(@CurrentAuth() auth: AuthContext, @Body() body: CreateEventDto): Promise<Plan> {
    return this.plans.createEvent(await this.identity.resolveProfile(auth), body);
  }

  @Post('trips')
  async createTrip(@CurrentAuth() auth: AuthContext, @Body() body: CreateTripDto): Promise<Plan> {
    return this.plans.createTrip(await this.identity.resolveProfile(auth), body);
  }

  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<Plan> {
    return this.plans.get(await this.identity.resolveProfile(auth), id);
  }

  /** Shared details; `If-Match: <version>` is required. */
  @Patch(':id')
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: UpdatePlanDto,
    @Headers('if-match') ifMatch?: string,
  ): Promise<Plan> {
    const version = parseIfMatch(ifMatch);
    return this.membership.update(await this.identity.resolveProfile(auth), id, body, version);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Headers('if-match') ifMatch?: string): Promise<Plan> {
    const version = parseIfMatch(ifMatch);
    return this.membership.cancel(await this.identity.resolveProfile(auth), id, version);
  }

  @Post(':id/invitees')
  @HttpCode(200)
  async invite(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: InvitePeopleDto): Promise<Plan> {
    return this.membership.invite(await this.identity.resolveProfile(auth), id, body.personIds);
  }

  @Post(':id/response')
  @HttpCode(200)
  async respond(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: RespondDto): Promise<RespondToInvitationResponse> {
    return { plan: await this.membership.respond(await this.identity.resolveProfile(auth), id, body.answer) };
  }

  @Delete(':id/people/:personId')
  async removePerson(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('personId') personId: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<Plan> {
    const version = parseIfMatch(ifMatch);
    return this.membership.removePerson(await this.identity.resolveProfile(auth), id, personId, version);
  }

  @Post(':id/owner')
  @HttpCode(200)
  async transfer(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: TransferOwnershipDto,
    @Headers('if-match') ifMatch?: string,
  ): Promise<Plan> {
    const version = parseIfMatch(ifMatch);
    return this.membership.transferOwnership(await this.identity.resolveProfile(auth), id, body.personId, version);
  }

  @Post(':id/leave')
  @HttpCode(204)
  async leave(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Headers('if-match') ifMatch?: string): Promise<void> {
    const version = parseIfMatch(ifMatch);
    await this.plans.leave(await this.identity.resolveProfile(auth), id, version);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Headers('if-match') ifMatch?: string): Promise<void> {
    const version = parseIfMatch(ifMatch);
    await this.plans.remove(await this.identity.resolveProfile(auth), id, version);
  }

  @Put(':id/mute')
  @HttpCode(204)
  async mute(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: MutePlanDto): Promise<void> {
    await this.plans.setMuted(await this.identity.resolveProfile(auth), id, body.muted);
  }

  @Get(':id/invitations')
  async listInvitations(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<{ items: InvitationSummary[] }> {
    return { items: await this.invitations.list(await this.identity.resolveProfile(auth), id) };
  }

  @Post(':id/invitations')
  async createInvitation(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: CreateInvitationDto,
  ): Promise<CreatedInvitation> {
    return this.invitations.create(await this.identity.resolveProfile(auth), id, body.expiresInHours);
  }

  @Delete(':id/invitations/:invitationId')
  @HttpCode(204)
  async revokeInvitation(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(await this.identity.resolveProfile(auth), id, invitationId);
  }
}

/** Opening an invitation link. The token travels in the body so it never lands in access logs. */
@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly invitations: InvitationsService,
  ) {}

  @Post('resolve')
  @HttpCode(200)
  async resolve(@CurrentAuth() auth: AuthContext, @Body() body: InvitationTokenDto): Promise<Invitation> {
    await this.identity.assertLive(auth);
    return this.invitations.resolve(body.token);
  }

  @Post('accept')
  @HttpCode(200)
  async accept(@CurrentAuth() auth: AuthContext, @Body() body: InvitationTokenDto): Promise<AcceptInvitationResponse> {
    return this.invitations.accept(await this.identity.resolveProfile(auth), body.token);
  }
}

/** The people catalogue and per-plan mutes, from membership. */
@Controller({ version: '1' })
export class PeopleController {
  constructor(
    private readonly identity: IdentityService,
    private readonly plans: PlansService,
  ) {}

  @Get('people')
  async people(@CurrentAuth() auth: AuthContext): Promise<PeopleList> {
    return { items: await this.plans.people(await this.identity.resolveProfile(auth)) };
  }

  @Get('me/muted-plans')
  async muted(@CurrentAuth() auth: AuthContext): Promise<MutedPlans> {
    return { planIds: await this.plans.mutedPlans(await this.identity.resolveProfile(auth)) };
  }
}
