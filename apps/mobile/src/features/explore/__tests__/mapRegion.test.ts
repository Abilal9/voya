import { regionFor } from '../MapExplore';
import type { Place } from '@/services';

const place = (id: string, latitude?: number, longitude?: number): Place => ({
  id, name: id, category: 'Food', city: 'Riyadh',
  coordinates: latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
});

describe('map region', () => {
  it('fits every pin with padding', () => {
    const r = regionFor([place('a', 24.70, 46.68), place('b', 24.78, 46.63)], null)!;
    expect(r.latitude).toBeCloseTo(24.74);
    expect(r.longitude).toBeCloseTo(46.655);
    expect(r.latitudeDelta).toBeGreaterThan(0.08);
    expect(r.longitudeDelta).toBeGreaterThan(0.05);
  });

  it('falls back to the city centre when no place has a location', () => {
    const r = regionFor([place('x')], { latitude: 35.68, longitude: 139.65 })!;
    expect(r.latitude).toBe(35.68);
    expect(r.longitude).toBe(139.65);
  });

  it('returns nothing to centre on when there is neither', () => {
    expect(regionFor([], null)).toBeUndefined();
  });
});
