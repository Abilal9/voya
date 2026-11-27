import type { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiErrorSchema, HealthResponseSchema, MeResponseSchema, PlacesPageSchema } from '@voya/contracts';
import { SignJWT } from 'jose';
import request from 'supertest';
import { encodeCursor } from '../src/places/places.service';
import { createTestApp, testEnv, testSigner } from './helpers';

const PLACE_ID = '00000000-0000-4000-8000-0000000000a1';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function placeRow(n: number) {
  return {
    id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
    seedRef: null, provider: 'fixture', providerRef: null, name: `Place ${n}`, type: null,
    category: 'Food', city: 'Riyadh', area: null, rating: null, price: null, photo: null, reason: null,
    description: null, hoursText: null, latitude: null, longitude: null, openNow: null,
    permanentlyClosed: null, tags: [], createdAt: new Date(), updatedAt: new Date(),
  };
}

function fakePrisma() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ pending: BigInt(0) }]),
    $disconnect: jest.fn(),
    place: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    profile: { upsert: jest.fn() },
  };
}

describe('Voya API (database and JWKS replaced)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof fakePrisma>;
  let signer: Awaited<ReturnType<typeof testSigner>>;

  beforeAll(async () => {
    signer = await testSigner();
  });

  beforeEach(async () => {
    prisma = fakePrisma();
    app = await createTestApp({
      prisma,
      keys: signer.keys,
      env: testEnv({ CORS_ORIGINS: 'https://admin.voya.test' }),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  function expectError(body: unknown, code: string) {
    const parsed = ApiErrorSchema.parse(body);
    expect(parsed.error.code).toBe(code);
    expect(parsed.error.requestId).toEqual(expect.any(String));
    return parsed.error;
  }

  describe('health', () => {
    it('GET /health is live, unversioned and public', async () => {
      const res = await http().get('/health').expect(200);
      expect(HealthResponseSchema.parse(res.body)).toMatchObject({ status: 'ok', service: 'voya-api' });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('GET /health/ready checks the database and migrations', async () => {
      const res = await http().get('/health/ready').expect(200);
      expect(res.body.checks).toEqual({
        database: { status: 'up', latencyMs: expect.any(Number) },
        migrations: { status: 'up' },
      });
    });

    it('GET /health/ready is 503 with a generic reason when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED postgres://postgres:pw@db'));
      const res = await http().get('/health/ready').expect(503);
      expect(res.body.status).toBe('error');
      expect(res.body.checks.database).toMatchObject({ status: 'down', reason: 'Database is not reachable' });
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    });
  });

  describe('request ids and security defaults', () => {
    it('mints a request id, or reuses a well-formed incoming one', async () => {
      const minted = await http().get('/health');
      expect(minted.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      const reused = await http().get('/health').set('x-request-id', 'client-trace-1234');
      expect(reused.headers['x-request-id']).toBe('client-trace-1234');
      const rejected = await http().get('/health').set('x-request-id', 'bad id with spaces <script>');
      expect(rejected.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('sends security headers and hides the framework', async () => {
      const res = await http().get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('allows only configured browser origins', async () => {
      const allowed = await http().get('/health').set('Origin', 'https://admin.voya.test');
      expect(allowed.headers['access-control-allow-origin']).toBe('https://admin.voya.test');
      const denied = await http().get('/health').set('Origin', 'https://evil.example');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers unknown routes with the error envelope', async () => {
      const res = await http().get('/api/v1/nope').expect(404);
      expectError(res.body, 'not_found');
      await http().get('/places').expect(404);
    });
  });

  describe('places', () => {
    it('lists a page with an opaque cursor when there is more', async () => {
      prisma.place.findMany.mockResolvedValue([placeRow(1), placeRow(2), placeRow(3)]);
      const res = await http().get('/api/v1/places?limit=2&city=Riyadh&category=Food').expect(200);
      const page = PlacesPageSchema.parse(res.body);
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe(encodeCursor(placeRow(2).id));
      expect(prisma.place.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3, where: { city: { equals: 'Riyadh', mode: 'insensitive' }, category: 'Food' } }),
      );
    });

    it('continues from a cursor', async () => {
      await http().get(`/api/v1/places?cursor=${encodeCursor(PLACE_ID)}`).expect(200);
      expect(prisma.place.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: PLACE_ID }, skip: 1 }));
    });

    it('rejects invalid query parameters with field-level issues', async () => {
      const res = await http().get('/api/v1/places?limit=0&category=Bars').expect(422);
      const error = expectError(res.body, 'validation_failed');
      expect(error.retryable).toBe(false);
      expect(error.issues?.map((i) => i.path).sort()).toEqual(['query.category', 'query.limit']);
    });

    it('rejects a tampered cursor', async () => {
      const res = await http().get('/api/v1/places?cursor=abc').expect(422);
      expect(expectError(res.body, 'validation_failed').issues).toEqual([{ path: 'query.cursor', message: 'Invalid cursor' }]);
    });

    it('404s an unknown or malformed place id', async () => {
      expectError((await http().get(`/api/v1/places/${PLACE_ID}`).expect(404)).body, 'not_found');
      expectError((await http().get('/api/v1/places/not-a-uuid').expect(404)).body, 'not_found');
    });

    it('hides internal errors behind a generic message', async () => {
      prisma.place.findMany.mockRejectedValue(new Error('relation "places" does not exist; password=hunter2'));
      const res = await http().get('/api/v1/places').expect(500);
      const error = expectError(res.body, 'internal');
      expect(error.retryable).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/hunter2|relation/);
    });

    it('maps an unreachable database to 503 unavailable', async () => {
      prisma.place.findMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Can't reach database server", { code: 'P1001', clientVersion: 'test' }),
      );
      const res = await http().get('/api/v1/places').expect(503);
      expectError(res.body, 'unavailable');
      expect(res.headers['retry-after']).toBe('5');
    });
  });

  describe('auth: GET /api/v1/me', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222', authUserId: USER_ID, seedRef: null,
      firstName: 'Omar', lastName: null, displayName: 'Omar', city: null, bio: null, interests: [],
      onboardingStep: 'profile', avatarPath: null, createdAt: new Date(), updatedAt: new Date(),
    };

    it('requires a bearer token', async () => {
      expectError((await http().get('/api/v1/me').expect(401)).body, 'unauthenticated');
      expectError((await http().get('/api/v1/me').set('Authorization', 'Basic abc').expect(401)).body, 'unauthenticated');
    });

    it('returns the caller profile for a valid Supabase token', async () => {
      prisma.profile.upsert.mockResolvedValue(profile);
      const token = await signer.sign({ sub: USER_ID, role: 'authenticated', email: 'omar@example.com', session_id: 's1' });
      const res = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(200);
      const me = MeResponseSchema.parse(res.body);
      expect(me.auth).toEqual({ authUserId: USER_ID, email: 'omar@example.com' });
      expect(me.profile).toMatchObject({ id: profile.id, onboardingComplete: false, onboardingStep: 'profile' });
      expect(prisma.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { authUserId: USER_ID } }),
      );
    });

    it.each([
      ['an expired token', () => signer.sign({ sub: USER_ID, role: 'authenticated' }, { expiresIn: Math.floor(Date.now() / 1000) - 60 })],
      ['another issuer', () => signer.sign({ sub: USER_ID, role: 'authenticated' }, { issuer: 'https://evil.example/auth/v1' })],
      ['another audience', () => signer.sign({ sub: USER_ID, role: 'authenticated' }, { audience: 'service' })],
      ['an anon-role token', () => signer.sign({ sub: USER_ID, role: 'anon' })],
      ['a non-UUID subject', () => signer.sign({ sub: 'p-ahmad', role: 'authenticated' })],
      ['a symmetric (HS256) token', () =>
        new SignJWT({ sub: USER_ID, role: 'authenticated' })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuer('http://supabase.test/auth/v1')
          .setAudience('authenticated')
          .setExpirationTime('5m')
          .sign(new TextEncoder().encode('super-secret-jwt-token-with-at-least-32-characters-long'))],
      ['garbage', async () => 'not.a.jwt'],
    ])('rejects %s', async (_label, makeToken) => {
      const res = await http().get('/api/v1/me').set('Authorization', `Bearer ${await makeToken()}`).expect(401);
      expectError(res.body, 'unauthenticated');
      expect(prisma.profile.upsert).not.toHaveBeenCalled();
    });

    it('tells an expired session apart', async () => {
      const token = await signer.sign({ sub: USER_ID, role: 'authenticated' }, { expiresIn: Math.floor(Date.now() / 1000) - 60 });
      const res = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
      expect(res.body.error.message).toMatch(/expired/);
    });
  });
});
