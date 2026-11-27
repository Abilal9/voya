import { z } from 'zod';
import { IdSchema } from './common';
import { OnboardingStepSchema } from './domain/person';

/**
 * Who is calling, as established by the API from a verified Supabase access
 * token. Never accepted from a request body.
 */
export const AuthContextSchema = z.object({
  /** Supabase `auth.users.id` (the token's `sub`). */
  authUserId: z.string().uuid(),
  email: z.string().email().optional(),
  /** Supabase role claim; `authenticated` for signed-in users. */
  role: z.string(),
  /** Session id (`session_id` claim) when present. */
  sessionId: z.string().optional(),
});
export type AuthContext = z.infer<typeof AuthContextSchema>;

/** GET /api/v1/me — the caller's Voya profile, created on first use. */
export const MeResponseSchema = z.object({
  profile: z.object({
    id: IdSchema,
    displayName: z.string(),
    firstName: z.string(),
    lastName: z.string().optional(),
    city: z.string().optional(),
    bio: z.string().optional(),
    onboardingStep: OnboardingStepSchema,
    onboardingComplete: z.boolean(),
    interests: z.array(z.string()),
  }),
  auth: AuthContextSchema.pick({ authUserId: true, email: true }),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
