import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put } from '@nestjs/common';
import {
  CompleteOnboardingStepRequestSchema,
  CreateAvatarUploadRequestSchema,
  SetAvatarRequestSchema,
  SetInterestsRequestSchema,
  UpdatePreferencesRequestSchema,
  UpdateProfileRequestSchema,
  type AccountPreferences,
  type AuthContext,
  type AvatarUpload,
  type MeResponse,
} from '@voya/contracts';
import type { Profile } from '@prisma/client';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RateLimit } from '../common/http/rate-limit';
import { zodDto } from '../common/validation/zod';
import { AccountService } from './account.service';
import { AvatarService } from './avatar.service';
import { IdentityService } from './identity.service';
import { ProfileService } from './profile.service';

class UpdateProfileDto extends zodDto(UpdateProfileRequestSchema) {}
class SetInterestsDto extends zodDto(SetInterestsRequestSchema) {}
class CompleteOnboardingDto extends zodDto(CompleteOnboardingStepRequestSchema) {}
class UpdatePreferencesDto extends zodDto(UpdatePreferencesRequestSchema) {}
class CreateAvatarUploadDto extends zodDto(CreateAvatarUploadRequestSchema) {}
class SetAvatarDto extends zodDto(SetAvatarRequestSchema) {}

/**
 * Self-service account routes. Each one resolves the caller's profile from
 * the verified token first; no route accepts a user or profile id, so there
 * is no way to address someone else's account.
 */
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly identity: IdentityService,
    private readonly profiles: ProfileService,
    private readonly avatars: AvatarService,
    private readonly accounts: AccountService,
  ) {}

  /** GET /api/v1/me — the caller's profile (created on first call). */
  @Get()
  async me(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    return this.respond(auth, await this.identity.resolveProfile(auth));
  }

  /** PATCH /api/v1/me — names, city, bio. */
  @Patch()
  async update(@CurrentAuth() auth: AuthContext, @Body() body: UpdateProfileDto): Promise<MeResponse> {
    const profile = await this.identity.resolveProfile(auth);
    return this.respond(auth, await this.profiles.update(profile, body));
  }

  /** PUT /api/v1/me/interests */
  @Put('interests')
  async interests(@CurrentAuth() auth: AuthContext, @Body() body: SetInterestsDto): Promise<MeResponse> {
    const profile = await this.identity.resolveProfile(auth);
    return this.respond(auth, await this.profiles.setInterests(profile, body.interests));
  }

  /** POST /api/v1/me/onboarding — completes a step (forward only). */
  @Post('onboarding')
  @HttpCode(200)
  async onboarding(@CurrentAuth() auth: AuthContext, @Body() body: CompleteOnboardingDto): Promise<MeResponse> {
    const profile = await this.identity.resolveProfile(auth);
    return this.respond(auth, await this.profiles.completeOnboardingStep(profile, body.step));
  }

  /** GET /api/v1/me/settings */
  @Get('settings')
  async settings(@CurrentAuth() auth: AuthContext): Promise<AccountPreferences> {
    return this.profiles.preferences(await this.identity.resolveProfile(auth));
  }

  /** PATCH /api/v1/me/settings */
  @Patch('settings')
  async updateSettings(@CurrentAuth() auth: AuthContext, @Body() body: UpdatePreferencesDto): Promise<AccountPreferences> {
    return this.profiles.updatePreferences(await this.identity.resolveProfile(auth), body);
  }

  /** POST /api/v1/me/avatar/uploads — a signed upload URL inside the caller's own folder. */
  @Post('avatar/uploads')
  @RateLimit('avatarUpload')
  async createAvatarUpload(@CurrentAuth() auth: AuthContext, @Body() body: CreateAvatarUploadDto): Promise<AvatarUpload> {
    return this.avatars.createUpload(await this.identity.resolveProfile(auth), body.contentType);
  }

  /** PUT /api/v1/me/avatar — makes an uploaded image the profile photo. */
  @Put('avatar')
  async setAvatar(@CurrentAuth() auth: AuthContext, @Body() body: SetAvatarDto): Promise<MeResponse> {
    const profile = await this.identity.resolveProfile(auth);
    return this.respond(auth, await this.avatars.commit(profile, body.path));
  }

  /** DELETE /api/v1/me/avatar — back to initials. */
  @Delete('avatar')
  async clearAvatar(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    const profile = await this.identity.resolveProfile(auth);
    return this.respond(auth, await this.avatars.clear(profile));
  }

  /** DELETE /api/v1/me — deletes the account (profile + login) for good. */
  @Delete()
  @HttpCode(204)
  @RateLimit('accountDelete')
  async remove(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.accounts.delete(await this.identity.resolveProfile(auth));
  }

  private async respond(auth: AuthContext, profile: Profile): Promise<MeResponse> {
    return { profile: await this.profiles.view(profile), auth: { authUserId: auth.authUserId, email: auth.email } };
  }
}
