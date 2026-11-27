import { z } from 'zod';
import { PageQuerySchema, pageSchema } from '../common';
import { PlaceCategorySchema, PlaceSchema } from '../domain/place';

/** GET /api/v1/places */
export const ListPlacesQuerySchema = PageQuerySchema.extend({
  city: z.string().min(1).max(80).optional(),
  category: PlaceCategorySchema.optional(),
});
export type ListPlacesQuery = z.infer<typeof ListPlacesQuerySchema>;

export const PlacesPageSchema = pageSchema(PlaceSchema);
export type PlacesPage = z.infer<typeof PlacesPageSchema>;
