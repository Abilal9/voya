import { z } from 'zod';
import { MeProfileSchema } from './api/me';

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
  /**
   * Names given at sign-up (`user_metadata.first_name/last_name`). Only used
   * to fill the caller's own profile when it is first created.
   */
  signUpNames: z.object({ firstName: z.string().optional(), lastName: z.string().optional() }).optional(),
});
export type AuthContext = z.infer<typeof AuthContextSchema>;

/** GET /api/v1/me — the caller's Voya profile, created on first use. */
export const MeResponseSchema = z.object({
  profile: MeProfileSchema,
  auth: AuthContextSchema.pick({ authUserId: true, email: true }),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
