import {
  ApiErrorSchema,
  CreateEventRequestSchema,
  CreateHangoutRequestSchema,
  CreateInvitationRequestSchema,
  CreateTripRequestSchema,
  InvitationTokenRequestSchema,
  ERROR_CODES,
  ERROR_RETRYABLE,
  ERROR_STATUS,
  ListPlacesQuerySchema,
  PlaceSchema,
  PlanMemberSchema,
  SetAvatarRequestSchema,
  SetInterestsRequestSchema,
  UpdatePreferencesRequestSchema,
  UpdateProfileRequestSchema,
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

describe('me (B1)', () => {
  it('trims profile fields and turns empty optional text into a clear (null)', () => {
    expect(UpdateProfileRequestSchema.parse({ firstName: ' Sara ', city: '', bio: null })).toEqual({
      firstName: 'Sara', city: null, bio: null,
    });
  });

  it('rejects identity fields, empty patches and over-long values', () => {
    expect(UpdateProfileRequestSchema.safeParse({ id: 'x', firstName: 'A' }).success).toBe(false);
    expect(UpdateProfileRequestSchema.safeParse({ authUserId: 'x' }).success).toBe(false);
    expect(UpdateProfileRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateProfileRequestSchema.safeParse({ firstName: '   ' }).success).toBe(false);
    expect(UpdateProfileRequestSchema.safeParse({ bio: 'x'.repeat(161) }).success).toBe(false);
  });

  it('dedupes interests and caps their number', () => {
    expect(SetInterestsRequestSchema.parse({ interests: ['Coffee', 'Coffee ', 'Padel'] })).toEqual({
      interests: ['Coffee', 'Padel'],
    });
    expect(SetInterestsRequestSchema.safeParse({ interests: Array.from({ length: 13 }, (_, i) => `i${i}`) }).success).toBe(false);
  });

  it('accepts partial preferences and rejects unknown keys and out-of-range radius', () => {
    expect(UpdatePreferencesRequestSchema.parse({ notifications: { planChanges: false } })).toEqual({
      notifications: { planChanges: false },
    });
    expect(UpdatePreferencesRequestSchema.safeParse({ notifications: { spam: true } }).success).toBe(false);
    expect(UpdatePreferencesRequestSchema.safeParse({ discoveryRadiusKm: 0 }).success).toBe(false);
    expect(UpdatePreferencesRequestSchema.safeParse({ mutedPlans: ['p'] }).success).toBe(false);
  });

  it('takes only a path to set an avatar', () => {
    expect(SetAvatarRequestSchema.safeParse({ path: 'a/b.jpg', profileId: 'x' }).success).toBe(false);
  });
});

describe('plans (B2)', () => {
  const startsAt = '2030-01-01T18:00:00.000Z';

  it('accepts only known hangout templates and no client-chosen ids', () => {
    expect(CreateHangoutRequestSchema.safeParse({ title: 'Friday', city: 'Riyadh', template: 'Dinner', startsAt }).success).toBe(true);
    expect(CreateHangoutRequestSchema.safeParse({ title: 'Friday', city: 'Riyadh', template: 'Brunch', startsAt }).success).toBe(false);
    expect(CreateHangoutRequestSchema.safeParse({ title: 'Friday', city: 'Riyadh', template: 'Dinner', startsAt, ownerId: 'x' }).success).toBe(false);
  });

  it('orders event and trip dates', () => {
    expect(CreateEventRequestSchema.safeParse({ title: 'W', venue: 'Hall', startsAt, endsAt: '2029-12-31T00:00:00.000Z' }).success).toBe(false);
    expect(CreateTripRequestSchema.safeParse({ destination: 'Florence', startDate: '2030-04-05', endDate: '2030-04-01' }).success).toBe(false);
    expect(CreateTripRequestSchema.safeParse({ destination: 'Florence', startDate: '2030-04-01', endDate: '2030-04-01' }).success).toBe(true);
  });

  it('bounds invitation tokens and expiry', () => {
    expect(InvitationTokenRequestSchema.safeParse({ token: 'a'.repeat(43) }).success).toBe(true);
    expect(InvitationTokenRequestSchema.safeParse({ token: '../../etc' }).success).toBe(false);
    expect(CreateInvitationRequestSchema.parse({})).toEqual({ expiresInHours: 336 });
    expect(CreateInvitationRequestSchema.safeParse({ expiresInHours: 24 * 31 }).success).toBe(false);
  });
});
