import type { Place as PlaceRow } from '@prisma/client';
import { PlaceSchema } from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { decodeCursor, encodeCursor, toPlace } from '../places/places.service';
import { capabilityFromDb, capabilityToDb, roleFromDb, roleToDb } from '../database/enums';
import { CAPABILITIES, PLAN_ROLES } from '@voya/contracts';

const row = (overrides: Partial<PlaceRow> = {}): PlaceRow => ({
  id: '00000000-0000-4000-8000-000000000001',
  seedRef: null,
  provider: 'fixture',
  providerRef: null,
  name: 'Somewhere',
  type: null,
  category: 'Food',
  city: 'Riyadh',
  area: null,
  rating: null,
  price: null,
  photo: null,
  reason: null,
  description: null,
  hoursText: null,
  latitude: null,
  longitude: null,
  openNow: null,
  permanentlyClosed: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('toPlace', () => {
  it('turns NULL columns into absent fields, never 0 or false', () => {
    const place = toPlace(row());
    expect(place).toEqual({ id: row().id, name: 'Somewhere', category: 'Food', city: 'Riyadh' });
    expect('rating' in place).toBe(false);
    expect('openNow' in place).toBe(false);
    expect(PlaceSchema.parse(place)).toEqual(place);
  });

  it('keeps real falsy values (closed now, rating 0)', () => {
    const place = toPlace(row({ openNow: false, rating: 0, latitude: 24.7, longitude: 46.6, tags: ['Popular'] }));
    expect(place.openNow).toBe(false);
    expect(place.rating).toBe(0);
    expect(place.coordinates).toEqual({ latitude: 24.7, longitude: 46.6 });
    expect(place.tags).toEqual(['Popular']);
  });
});

describe('cursor', () => {
  it('round-trips an id and rejects garbage', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(decodeCursor(encodeCursor(id))).toBe(id);
    expect(() => decodeCursor('not-a-cursor')).toThrow(AppError);
  });
});

describe('enum mapping', () => {
  it('round-trips every capability and role', () => {
    for (const c of CAPABILITIES) expect(capabilityFromDb(capabilityToDb(c))).toBe(c);
    for (const r of PLAN_ROLES) expect(roleFromDb(roleToDb(r))).toBe(r);
  });
});
