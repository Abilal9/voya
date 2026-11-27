import { z } from 'zod';
import { IdSchema } from '../common';

/** Mirrors `Person` in apps/mobile/src/services/types.ts. */
export const PersonSchema = z.object({
  id: IdSchema,
  firstName: z.string(),
  lastName: z.string().optional(),
  displayName: z.string(),
  city: z.string().optional(),
  bio: z.string().optional(),
});
export type Person = z.infer<typeof PersonSchema>;

export const ONBOARDING_STEPS = ['profile', 'interests', 'location', 'notifications', 'done'] as const;
export const OnboardingStepSchema = z.enum(ONBOARDING_STEPS);
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;
