import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';
import { OnboardingStepSchema } from '../domain/person';

/**
 * Self-service account API (B1): `/api/v1/me/*`. Every route acts on the
 * caller resolved from the verified access token; no route takes a user id.
 */

/** Field limits, matching the frozen Edit profile form (MAX_NAME / MAX_CITY / MAX_BIO). */
export const PROFILE_LIMITS = { name: 40, displayName: 81, city: 60, bio: 160, interests: 12, interest: 40 } as const;

const trimmed = (max: number) => z.string().trim().min(1).max(max);
/** Optional text the client may clear: `null` (or an empty string) removes it. */
const clearable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

/** The signed-in caller's profile as the API returns it. */
export const MeProfileSchema = z.object({
  id: IdSchema,
  displayName: z.string(),
  firstName: z.string(),
  lastName: z.string().optional(),
  city: z.string().optional(),
  bio: z.string().optional(),
  onboardingStep: OnboardingStepSchema,
  onboardingComplete: z.boolean(),
  interests: z.array(z.string()),
  /** Short-lived signed URL of the profile photo; absent when there is none. */
  avatarUrl: z.string().url().optional(),
  /** When `avatarUrl` stops working. */
  avatarUrlExpiresAt: IsoDateTimeSchema.optional(),
});
export type MeProfile = z.infer<typeof MeProfileSchema>;

/** PATCH /api/v1/me. Unknown keys (ids, onboarding, interests) are rejected. */
export const UpdateProfileRequestSchema = z
  .object({
    firstName: trimmed(PROFILE_LIMITS.name),
    lastName: clearable(PROFILE_LIMITS.name),
    displayName: trimmed(PROFILE_LIMITS.displayName),
    city: clearable(PROFILE_LIMITS.city),
    bio: clearable(PROFILE_LIMITS.bio),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to update');
export type UpdateProfileRequest = z.input<typeof UpdateProfileRequestSchema>;

/** PUT /api/v1/me/interests — replaces the list (duplicates removed, order kept). */
export const SetInterestsRequestSchema = z
  .object({
    interests: z.array(trimmed(PROFILE_LIMITS.interest)).max(PROFILE_LIMITS.interests),
  })
  .strict()
  .transform(({ interests }) => ({ interests: [...new Set(interests)] }));
export type SetInterestsRequest = z.input<typeof SetInterestsRequestSchema>;

/**
 * POST /api/v1/me/onboarding — marks `step` complete. Onboarding only moves
 * forward: completing an earlier step again never sends the account back.
 */
export const CompleteOnboardingStepRequestSchema = z.object({ step: OnboardingStepSchema }).strict();
export type CompleteOnboardingStepRequest = z.infer<typeof CompleteOnboardingStepRequestSchema>;

// ------------------------------------------------------------------ settings

/** Mirrors `NotificationKey` in the app (board V04). */
export const NOTIFICATION_KEYS = [
  'newSuggestions', 'votesAndDecisions', 'planChanges', 'itineraryReady',
  'newInvitations', 'rsvpUpdates',
  'upcomingActivities', 'scheduleChanges',
  'recommendations', 'productUpdates',
] as const;
export const NotificationKeySchema = z.enum(NOTIFICATION_KEYS);
export type NotificationKey = z.infer<typeof NotificationKeySchema>;

export const DISCOVERY_RADIUS_KM = { min: 1, max: 50 } as const;

const notificationShape = Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, z.boolean()])) as Record<
  NotificationKey,
  z.ZodBoolean
>;
export const NotificationPreferencesSchema = z.object(notificationShape).strict();

/**
 * Account preferences kept on the server (V04–V06). Per-plan mutes stay on
 * the device until plans are served by the API (B2).
 */
export const AccountPreferencesSchema = z.object({
  notifications: NotificationPreferencesSchema,
  /** V06 "Use precise location": a preference; the OS permission is separate. */
  preciseLocation: z.boolean(),
  discoveryRadiusKm: z.number().int().min(DISCOVERY_RADIUS_KM.min).max(DISCOVERY_RADIUS_KM.max),
});
export type AccountPreferences = z.infer<typeof AccountPreferencesSchema>;

/** Board V04–V06 defaults: plan, invitation and in-plan alerts on; Voya news off. */
export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  notifications: {
    newSuggestions: true, votesAndDecisions: true, planChanges: true, itineraryReady: true,
    newInvitations: true, rsvpUpdates: true,
    upcomingActivities: true, scheduleChanges: true,
    recommendations: false, productUpdates: false,
  },
  preciseLocation: true,
  discoveryRadiusKm: 15,
};

/** PATCH /api/v1/me/settings — any subset; notifications merge key by key. */
export const UpdatePreferencesRequestSchema = z
  .object({
    notifications: NotificationPreferencesSchema.partial(),
    preciseLocation: z.boolean(),
    discoveryRadiusKm: AccountPreferencesSchema.shape.discoveryRadiusKm,
  })
  .partial()
  .strict();
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;

// -------------------------------------------------------------------- avatar

/** What the private `avatars` bucket accepts (supabase/config.toml). */
export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const AvatarContentTypeSchema = z.enum(AVATAR_CONTENT_TYPES);
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** POST /api/v1/me/avatar/uploads — asks for a one-off signed upload URL. */
export const CreateAvatarUploadRequestSchema = z.object({ contentType: AvatarContentTypeSchema }).strict();
export type CreateAvatarUploadRequest = z.infer<typeof CreateAvatarUploadRequestSchema>;

export const AvatarUploadSchema = z.object({
  /** Object path, always inside the caller's own folder. Send it back to PUT /me/avatar. */
  path: z.string(),
  /** PUT the image bytes here with the same Content-Type. No key is needed. */
  uploadUrl: z.string().url(),
  contentType: AvatarContentTypeSchema,
  maxBytes: z.number().int(),
});
export type AvatarUpload = z.infer<typeof AvatarUploadSchema>;

/** PUT /api/v1/me/avatar — makes an uploaded object the profile photo. */
export const SetAvatarRequestSchema = z.object({ path: z.string().min(1).max(256) }).strict();
export type SetAvatarRequest = z.infer<typeof SetAvatarRequestSchema>;
