import { z } from 'zod';

/** Opaque identifier. Today a UUID from the API, or a fixture id like `p-ahmad` from the mocks. */
export const IdSchema = z.string().min(1).max(128);
export type Id = z.infer<typeof IdSchema>;

/** ISO-8601 instant with an offset, e.g. `2026-11-27T18:00:00.000Z`. */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** Date only, `YYYY-MM-DD` (trip dates are floating local dates). */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/**
 * Cursor pagination. The cursor is opaque to clients: send back exactly what
 * the previous page returned as `nextCursor`.
 */
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 100;

export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
  cursor: z.string().min(1).max(512).optional(),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    /** null when this is the last page. */
    nextCursor: z.string().nullable(),
  });
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
