import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { HealthResponseSchema, MeResponseSchema, PlacesPageSchema } from '@voya/contracts';
import request from 'supertest';
import { seed } from '../../prisma/seed';
import { createTestApp } from '../helpers';
import { localEnv, signUpTestUser } from './local-stack';

/**
 * Real database (local Supabase Postgres via Prisma) and real Supabase Auth
 * (ES256 tokens verified against the live local JWKS). Nothing is mocked.
 */
describe('backend against the local Supabase stack', () => {
  const env = localEnv();
  const prisma = new PrismaClient();
  let app: INestApplication;
  const email = `it-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createTestApp({ env });
  });

  afterAll(async () => {
    await prisma.profile.deleteMany({ where: { authUserId: { not: null }, firstName: { startsWith: 'It ' } } });
    await prisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE 'it-%@example.com'`;
    await app.close();
    await prisma.$disconnect();
  });

  it('has every migration applied', async () => {
    const rows = await prisma.$queryRaw<{ name: string; finished: boolean }[]>`
      SELECT migration_name AS name, finished_at IS NOT NULL AS finished FROM "_prisma_migrations"`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.finished)).toBe(true);
  });

  it('keeps app tables away from the Data API roles (RLS on, no grants)', async () => {
    const rows = await prisma.$queryRaw<{ relname: string; rls: boolean; anon: boolean; authed: boolean }[]>`
      SELECT c.relname, c.relrowsecurity AS rls,
             has_table_privilege('anon', c.oid, 'SELECT') AS anon,
             has_table_privilege('authenticated', c.oid, 'SELECT') AS authed
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN
        ('profiles','places','plans','plan_members','invitations','activity_entries')`;
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row).toMatchObject({ rls: true, anon: false, authed: false });
  });

  it('seeds reproducibly: a second run changes nothing', async () => {
    const count = async () => [
      await prisma.profile.count({ where: { seedRef: { not: null } } }),
      await prisma.place.count(),
      await prisma.plan.count(),
      await prisma.planMember.count(),
    ];
    await prisma.$transaction((tx) => seed(tx as PrismaClient), { timeout: 30_000 });
    const first = await count();
    await prisma.$transaction((tx) => seed(tx as PrismaClient), { timeout: 30_000 });
    expect(await count()).toEqual(first);
    expect(first).toEqual([5, 27, 6, expect.any(Number)]);
  });

  it('preserves damaged place data as absence', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/places?limit=100').expect(200);
    const page = PlacesPageSchema.parse(res.body);
    expect(page.items.length).toBe(27);
    expect(page.items.some((p) => p.rating === undefined)).toBe(true);
    expect(page.items.some((p) => p.openNow === undefined)).toBe(true);
    expect(page.items.some((p) => p.openNow === false)).toBe(true);
  });

  it('pages through the catalogue without gaps or repeats', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: request.Response = await request(app.getHttpServer())
        .get('/api/v1/places')
        .query({ limit: 10, ...(cursor ? { cursor } : {}) })
        .expect(200);
      const page = PlacesPageSchema.parse(res.body);
      seen.push(...page.items.map((p) => p.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(27);
    expect(new Set(seen).size).toBe(27);
  });

  it('is ready', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(HealthResponseSchema.parse(res.body).checks).toMatchObject({ database: { status: 'up' }, migrations: { status: 'up' } });
  });

  it('verifies a real Supabase session and maps it to one profile', async () => {
    const user = await signUpTestUser(env, email);
    const call = () =>
      request(app.getHttpServer()).get('/api/v1/me').set('Authorization', `Bearer ${user.accessToken}`).expect(200);
    const first = MeResponseSchema.parse((await call()).body);
    const second = MeResponseSchema.parse((await call()).body);
    expect(first.auth).toEqual({ authUserId: user.userId, email });
    expect(second.profile.id).toBe(first.profile.id);
    expect(await prisma.profile.count({ where: { authUserId: user.userId } })).toBe(1);
  });
});
