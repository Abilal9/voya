import {
  ApiErrorSchema,
  ERROR_CODES,
  ERROR_RETRYABLE,
  ERROR_STATUS,
  ListPlacesQuerySchema,
  PlaceSchema,
  PlanMemberSchema,
} from '..';

describe('pagination query', () => {
  it('defaults and coerces the limit from a query string', () => {
    expect(ListPlacesQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ListPlacesQuerySchema.parse({ limit: '5', city: 'Riyadh' })).toEqual({ limit: 5, city: 'Riyadh' });
  });

  it('rejects limits outside 1..100 and unknown categories', () => {
    expect(ListPlacesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(ListPlacesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(ListPlacesQuerySchema.safeParse({ category: 'Bars' }).success).toBe(false);
  });
});

describe('place', () => {
  it('accepts a damaged place with every optional field missing', () => {
    const parsed = PlaceSchema.parse({ id: 'pl-x', name: 'Somewhere', category: 'Food', city: 'Riyadh' });
    expect(parsed.rating).toBeUndefined();
    expect(parsed.openNow).toBeUndefined();
  });

  it('rejects a rating outside 0..5', () => {
    expect(PlaceSchema.safeParse({ id: 'a', name: 'b', category: 'Food', city: 'c', rating: 7 }).success).toBe(false);
  });
});

describe('plan member', () => {
  it('rejects an unknown capability', () => {
    const result = PlanMemberSchema.safeParse({
      personId: 'p-1', role: 'guest', capabilities: ['plan.explode'], joinedAt: '2026-11-27T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('errors', () => {
  it('has a status and retry policy for every code', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(typeof ERROR_RETRYABLE[code]).toBe('boolean');
    }
  });

  it('validates the error envelope', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'not_found', message: 'Nope', retryable: false } }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: 'teapot', message: 'x', retryable: false } }).success).toBe(false);
  });
});
