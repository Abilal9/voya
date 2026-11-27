import { Controller, Get } from '@nestjs/common';
import type { AuthContext, MeResponse } from '@voya/contracts';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { IdentityService } from './identity.service';

@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(private readonly identity: IdentityService) {}

  /** GET /api/v1/me — the signed-in caller's profile (created on first call). */
  @Get()
  async me(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    const profile = await this.identity.resolveProfile(auth);
    return {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName ?? undefined,
        city: profile.city ?? undefined,
        bio: profile.bio ?? undefined,
        onboardingStep: profile.onboardingStep,
        onboardingComplete: profile.onboardingStep === 'done',
        interests: profile.interests,
      },
      auth: { authUserId: auth.authUserId, email: auth.email },
    };
  }
}
