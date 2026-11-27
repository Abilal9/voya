import { Injectable } from '@nestjs/common';
import { Prisma, type Profile } from '@prisma/client';
import {
  AccountPreferencesSchema,
  DEFAULT_ACCOUNT_PREFERENCES,
  NotificationPreferencesSchema,
  ONBOARDING_STEPS,
  type AccountPreferences,
  type MeProfile,
  type OnboardingStep,
  type UpdatePreferencesRequest,
} from '@voya/contracts';
import { PrismaService } from '../database/prisma.service';
import { AvatarService } from './avatar.service';

/** Parsed PATCH /me body: present keys change, `null` clears an optional field. */
export interface ProfilePatch {
  firstName?: string;
  lastName?: string | null;
  displayName?: string;
  city?: string | null;
  bio?: string | null;
}

/**
 * The caller's own profile, interests, onboarding and preferences. Every
 * method takes the profile already resolved from the verified token, so a
 * caller can only ever read or change their own rows.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
  ) {}

  async view(profile: Profile): Promise<MeProfile> {
    const avatar = profile.avatarPath ? await this.avatars.signedUrl(profile.avatarPath) : undefined;
    return {
      id: profile.id,
      displayName: profile.displayName,
      firstName: profile.firstName,
      lastName: profile.lastName ?? undefined,
      city: profile.city ?? undefined,
      bio: profile.bio ?? undefined,
      onboardingStep: profile.onboardingStep,
      onboardingComplete: profile.onboardingStep === 'done',
      interests: profile.interests,
      avatarUrl: avatar?.url,
      avatarUrlExpiresAt: avatar?.expiresAt,
    };
  }

  async update(profile: Profile, patch: ProfilePatch): Promise<Profile> {
    const data: Prisma.ProfileUpdateInput = { ...patch };
    // Keep the display name in step with a name change unless one was sent.
    if (patch.displayName === undefined && (patch.firstName !== undefined || patch.lastName !== undefined)) {
      const first = patch.firstName ?? profile.firstName;
      const last = patch.lastName === undefined ? profile.lastName : patch.lastName;
      data.displayName = [first, last].filter(Boolean).join(' ');
    }
    return this.prisma.profile.update({ where: { id: profile.id }, data });
  }

  setInterests(profile: Profile, interests: string[]): Promise<Profile> {
    return this.prisma.profile.update({ where: { id: profile.id }, data: { interests } });
  }

  /** Marks `step` done. Moves forward only; an earlier step never sends the account back. */
  async completeOnboardingStep(profile: Profile, step: OnboardingStep): Promise<Profile> {
    const next = nextStep(profile.onboardingStep, step);
    if (next === profile.onboardingStep) return profile;
    return this.prisma.profile.update({ where: { id: profile.id }, data: { onboardingStep: next } });
  }

  async preferences(profile: Profile): Promise<AccountPreferences> {
    const row = await this.prisma.accountSettings.findUnique({ where: { profileId: profile.id } });
    return row ? fromRow(row) : structuredClone(DEFAULT_ACCOUNT_PREFERENCES);
  }

  async updatePreferences(profile: Profile, patch: UpdatePreferencesRequest): Promise<AccountPreferences> {
    // Serialised per profile so two quick toggles cannot overwrite each other.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${profile.id}, 7))`;
      const row = await tx.accountSettings.findUnique({ where: { profileId: profile.id } });
      const current = row ? fromRow(row) : structuredClone(DEFAULT_ACCOUNT_PREFERENCES);
      const next = AccountPreferencesSchema.parse({
        ...current,
        ...patch,
        notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
      });
      const data = {
        notifications: next.notifications,
        preciseLocation: next.preciseLocation,
        discoveryRadiusKm: next.discoveryRadiusKm,
      };
      await tx.accountSettings.upsert({
        where: { profileId: profile.id },
        create: { profileId: profile.id, ...data },
        update: data,
      });
      return next;
    });
  }
}

export function nextStep(current: OnboardingStep, completed: OnboardingStep): OnboardingStep {
  const after = ONBOARDING_STEPS[Math.min(ONBOARDING_STEPS.indexOf(completed) + 1, ONBOARDING_STEPS.length - 1)]!;
  return ONBOARDING_STEPS.indexOf(after) > ONBOARDING_STEPS.indexOf(current) ? after : current;
}

/** Stored notifications are merged over the defaults, so keys added later get their default. */
function fromRow(row: { notifications: Prisma.JsonValue; preciseLocation: boolean; discoveryRadiusKm: number }): AccountPreferences {
  const stored = NotificationPreferencesSchema.partial().strip().safeParse(row.notifications);
  return {
    notifications: { ...DEFAULT_ACCOUNT_PREFERENCES.notifications, ...(stored.success ? stored.data : {}) },
    preciseLocation: row.preciseLocation,
    discoveryRadiusKm: row.discoveryRadiusKm,
  };
}
