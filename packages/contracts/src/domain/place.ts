import { z } from 'zod';
import { IdSchema } from '../common';

export const PLACE_CATEGORIES = [
  'Food', 'Coffee', 'Dessert', 'Activities', 'Culture',
  'Shopping', 'Nature', 'Nightlife', 'Experiences',
] as const;
export const PlaceCategorySchema = z.enum(PLACE_CATEGORIES);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Mirrors `Place` in apps/mobile/src/services/types.ts.
 *
 * Optional really means optional: provider data is incomplete. In particular
 * `openNow` absent means UNKNOWN, which is not closed. The API must never
 * coerce a missing value to `0`, `false` or an empty string.
 */
export const PlaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  type: z.string().optional(),
  category: PlaceCategorySchema,
  city: z.string(),
  area: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  price: z.string().optional(),
  photo: z.string().optional(),
  reason: z.string().optional(),
  description: z.string().optional(),
  hoursText: z.string().optional(),
  coordinates: CoordinatesSchema.optional(),
  openNow: z.boolean().optional(),
  permanentlyClosed: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});
export type Place = z.infer<typeof PlaceSchema>;
