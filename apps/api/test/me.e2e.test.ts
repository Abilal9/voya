import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AccountPreferencesSchema,
  ApiErrorSchema,
  AvatarUploadSchema,
  DEFAULT_ACCOUNT_PREFERENCES,
  MeResponseSchema,
} from '@voya/contracts';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JWT_KEY_SOURCE } from '../src/auth/jwt-verifier';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { StorageClient } from '../src/storage/storage.client';
import { testEnv, testSigner } from './helpers';

/**
 * B1 self-service account API with an in-memory database and storage. Covers
 * provisioning, profile/interests/onboarding/settings updates, avatars,
 * deletion, and that two accounts can never touch each other's data.
 */

type Row = Record<string, unknown> & { id: string };

function fakeDb() {
  const profiles = new Map<string, Row>();
  const settings = new Map<string, Row>();
  const users = new Map<string, { deleted: boolean; sessions: Set<string> }>();
  const counts = { plans: 0, members: 0, invitations: 0 };

  const byAuth = (authUserId: string) => [...profiles.values()].find((p) => p.authUserId === authUserId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    profiles, settings, users, counts,
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (!strings.join('').includes('auth.users')) return [{ pending: BigInt(0) }];
      const [userId, sessionId] = values as [string, string | null];
      const user = users.get(userId);
      return [{ user_ok: !!user && !user.deleted, session_ok: sessionId === null || !!user?.sessions.has(sessionId) }];
    }),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('').includes('DELETE FROM auth.users')) users.get(values[0] as string)!.deleted = true;
      return 1;
    }),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(db)),
    profile: {
      upsert: jest.fn(async ({ where, create }: { where: { authUserId: string }; create: Row }) => {
        const existing = byAuth(where.authUserId);
        if (existing) return { ...existing };
        const row = {
          seedRef: null, lastName: null, city: null, bio: null, interests: [],
          onboardingStep: 'profile', avatarPath: null, createdAt: new Date(), updatedAt: new Date(), ...create,
          id: randomUUID(),
        } as Row;
        profiles.set(row.id, row);
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = profiles.get(where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return { ...row };
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        profiles.delete(where.id);
        settings.delete(where.id);
      }),
    },
    accountSettings: {
      findUnique: jest.fn(async ({ where }: { where: { profileId: string } }) => settings.get(where.profileId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: { where: { profileId: string }; create: Row; update: Row }) => {
        const row = settings.get(where.profileId);
        settings.set(where.profileId, row ? { ...row, ...update } : { ...create, id: where.profileId });
      }),
    },
    plan: { count: jest.fn(async () => counts.plans) },
    planMember: { count: jest.fn(async () => counts.members) },
    invitation: { count: jest.fn(async () => counts.invitations) },
  };
  return db as {
    profiles: typeof profiles; settings: typeof settings; users: typeof users; counts: typeof counts;
  };
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function fakeStorage() {
  const objects = new Map<string, { bytes: number[]; size: number; contentType: string }>();
  return {
    objects,
    configured: true,
    createSignedUploadUrl: jest.fn(async (bucket: string, path: string) =>
      `http://supabase.test/storage/v1/object/upload/sign/${bucket}/${path}?token=t`),
    createSignedUrl: jest.fn(async (bucket: string, path: string) =>
      `http://supabase.test/storage/v1/object/sign/${bucket}/${path}?token=d`),
    info: jest.fn(async (_b: string, path: string) => {
      const o = objects.get(path);
      return o ? { size: o.size, contentType: o.contentType } : null;
    }),
    head: jest.fn(async (_b: string, path: string, n: number) => Uint8Array.from(objects.get(path)!.bytes.slice(0, n))),
    list: jest.fn(async (_b: string, prefix: string) => [...objects.keys()].filter((k) => k.startsWith(`${prefix}/`))),
    remove: jest.fn(async (_b: string, paths: string[]) => paths.forEach((p) => objects.delete(p))),
  };
}

describe('B1 /api/v1/me (in-memory database and storage)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof fakeDb>;
  let storage: ReturnType<typeof fakeStorage>;
  let signer: Awaited<ReturnType<typeof testSigner>>;

  beforeAll(async () => {
    signer = await testSigner();
  });

  beforeEach(async () => {
    db = fakeDb();
    storage = fakeStorage();
    const env = testEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(PrismaService).useValue(db)
      .overrideProvider(JWT_KEY_SOURCE).useValue(signer.keys)
      .overrideProvider(StorageClient).useValue(storage)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app, env);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /** A live Supabase user with one session; returns an authorised request maker. */
  async function user(claims: Record<string, unknown> = {}) {
    const id = randomUUID();
    const session = randomUUID();
    db.users.set(id, { deleted: false, sessions: new Set([session]) });
    const token = await signer.sign({ sub: id, role: 'authenticated', email: `${id.slice(0, 6)}@example.com`, session_id: session, ...claims });
    const as = (method: 'get' | 'patch' | 'put' | 'post' | 'delete', path: string) =>
      request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
    return { id, session, token, as };
  }

  const errorCode = (body: unknown) => ApiErrorSchema.parse(body).error.code;

  describe('provisioning', () => {
    it('creates the profile once, from the sign-up names, however often /me is called', async () => {
      const u = await user({ user_metadata: { first_name: ' Sara ', last_name: 'Al Harbi' } });
      const [a, b] = await Promise.all([u.as('get', '/me').expect(200), u.as('get', '/me').expect(200)]);
      const me = MeResponseSchema.parse(a.body);
      expect(MeResponseSchema.parse(b.body).profile.id).toBe(me.profile.id);
      expect(db.profiles.size).toBe(1);
      expect(me.profile).toMatchObject({ firstName: 'Sara', lastName: 'Al Harbi', displayName: 'Sara Al Harbi', onboardingStep: 'profile' });
      expect(me.profile.avatarUrl).toBeUndefined();
    });

    it('falls back to a name from the email when sign-up gave none', async () => {
      const u = await user({ email: 'noura.k@example.com' });
      const me = MeResponseSchema.parse((await u.as('get', '/me').expect(200)).body);
      expect(me.profile.firstName).toBe('Noura k');
    });

    it('refuses a token whose user was deleted, and does not re-create the profile', async () => {
      const u = await user();
      db.users.get(u.id)!.deleted = true;
      expect(errorCode((await u.as('get', '/me').expect(401)).body)).toBe('unauthenticated');
      expect(db.profiles.size).toBe(0);
    });

    it('refuses a token whose session was revoked (signed out elsewhere)', async () => {
      const u = await user();
      db.users.get(u.id)!.sessions.clear();
      const res = await u.as('get', '/me').expect(401);
      expect(res.body.error.message).toMatch(/session has ended/);
    });

    it('refuses an anonymous sign-in token', async () => {
      const u = await user({ is_anonymous: true });
      await u.as('get', '/me').expect(401);
    });
  });

  describe('profile', () => {
    it('updates names, city and bio, keeps the display name in step, and clears with null', async () => {
      const u = await user();
      await u.as('patch', '/me').send({ firstName: 'Lama', lastName: 'Saad', city: 'Jeddah', bio: 'Coffee first.' }).expect(200);
      let me = MeResponseSchema.parse((await u.as('get', '/me').expect(200)).body);
      expect(me.profile).toMatchObject({ firstName: 'Lama', lastName: 'Saad', displayName: 'Lama Saad', city: 'Jeddah', bio: 'Coffee first.' });
      me = MeResponseSchema.parse((await u.as('patch', '/me').send({ city: null, bio: '' }).expect(200)).body);
      expect(me.profile.city).toBeUndefined();
      expect(me.profile.bio).toBeUndefined();
    });

    it('rejects identity fields and invalid values without changing anything', async () => {
      const u = await user();
      await u.as('get', '/me').expect(200);
      const before = JSON.stringify([...db.profiles.values()]);
      expect(errorCode((await u.as('patch', '/me').send({ id: randomUUID(), firstName: 'X' }).expect(422)).body)).toBe('validation_failed');
      expect(errorCode((await u.as('patch', '/me').send({ authUserId: randomUUID() }).expect(422)).body)).toBe('validation_failed');
      expect(errorCode((await u.as('patch', '/me').send({ firstName: '' }).expect(422)).body)).toBe('validation_failed');
      expect(errorCode((await u.as('patch', '/me').send({ bio: 'x'.repeat(161) }).expect(422)).body)).toBe('validation_failed');
      expect(JSON.stringify([...db.profiles.values()])).toBe(before);
    });

    it('replaces interests (deduplicated)', async () => {
      const u = await user();
      const res = await u.as('put', '/me/interests').send({ interests: ['Coffee', 'Padel', 'Coffee'] }).expect(200);
      expect(MeResponseSchema.parse(res.body).profile.interests).toEqual(['Coffee', 'Padel']);
    });

    it('moves onboarding forward only', async () => {
      const u = await user();
      let me = MeResponseSchema.parse((await u.as('post', '/me/onboarding').send({ step: 'interests' }).expect(200)).body);
      expect(me.profile.onboardingStep).toBe('location');
      me = MeResponseSchema.parse((await u.as('post', '/me/onboarding').send({ step: 'profile' }).expect(200)).body);
      expect(me.profile.onboardingStep).toBe('location');
      me = MeResponseSchema.parse((await u.as('post', '/me/onboarding').send({ step: 'notifications' }).expect(200)).body);
      expect(me.profile).toMatchObject({ onboardingStep: 'done', onboardingComplete: true });
      await u.as('post', '/me/onboarding').send({ step: 'finished' }).expect(422);
    });
  });

  describe('settings', () => {
    it('starts from the board defaults and persists partial changes', async () => {
      const u = await user();
      const initial = AccountPreferencesSchema.parse((await u.as('get', '/me/settings').expect(200)).body);
      expect(initial).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
      await u.as('patch', '/me/settings').send({ notifications: { planChanges: false }, discoveryRadiusKm: 30 }).expect(200);
      await u.as('patch', '/me/settings').send({ preciseLocation: false }).expect(200);
      const now = AccountPreferencesSchema.parse((await u.as('get', '/me/settings').expect(200)).body);
      expect(now).toEqual({
        ...DEFAULT_ACCOUNT_PREFERENCES,
        notifications: { ...DEFAULT_ACCOUNT_PREFERENCES.notifications, planChanges: false },
        discoveryRadiusKm: 30,
        preciseLocation: false,
      });
    });

    it('rejects unknown keys and out-of-range values', async () => {
      const u = await user();
      await u.as('patch', '/me/settings').send({ discoveryRadiusKm: 500 }).expect(422);
      await u.as('patch', '/me/settings').send({ notifications: { marketingBlast: true } }).expect(422);
      await u.as('patch', '/me/settings').send({ mutedPlans: ['x'] }).expect(422);
    });
  });

  describe('account isolation', () => {
    it('keeps two accounts apart: each reads and writes only its own profile and settings', async () => {
      const a = await user();
      const b = await user();
      await a.as('patch', '/me').send({ firstName: 'Alice' }).expect(200);
      await b.as('patch', '/me').send({ firstName: 'Basma' }).expect(200);
      await a.as('patch', '/me/settings').send({ discoveryRadiusKm: 5 }).expect(200);
      const meA = MeResponseSchema.parse((await a.as('get', '/me').expect(200)).body);
      const meB = MeResponseSchema.parse((await b.as('get', '/me').expect(200)).body);
      expect(meA.profile.firstName).toBe('Alice');
      expect(meB.profile.firstName).toBe('Basma');
      expect(meA.profile.id).not.toBe(meB.profile.id);
      expect(AccountPreferencesSchema.parse((await b.as('get', '/me/settings').expect(200)).body).discoveryRadiusKm).toBe(15);
    });

    it('has no route that takes someone else\'s id', async () => {
      const a = await user();
      const b = await user();
      const meB = MeResponseSchema.parse((await b.as('get', '/me').expect(200)).body);
      await a.as('patch', `/me/${meB.profile.id}`).send({ firstName: 'Hacked' }).expect(404);
      await a.as('get', `/profiles/${meB.profile.id}`).expect(404);
      expect(db.profiles.get(meB.profile.id)!.firstName).not.toBe('Hacked');
    });
  });

  describe('avatar', () => {
    async function upload(u: Awaited<ReturnType<typeof user>>, bytes = PNG, contentType = 'image/png') {
      const slot = AvatarUploadSchema.parse((await u.as('post', '/me/avatar/uploads').send({ contentType }).expect(201)).body);
      storage.objects.set(slot.path, { bytes, size: 2048, contentType });
      return slot;
    }

    it('uploads into the caller\'s own folder, commits, signs a URL and removes the old photo', async () => {
      const u = await user();
      const me = MeResponseSchema.parse((await u.as('get', '/me').expect(200)).body);
      const first = await upload(u);
      expect(first.path.startsWith(`${me.profile.id}/`)).toBe(true);
      expect(first.uploadUrl).toContain('/object/upload/sign/avatars/');
      let res = MeResponseSchema.parse((await u.as('put', '/me/avatar').send({ path: first.path }).expect(200)).body);
      expect(res.profile.avatarUrl).toContain(first.path);
      expect(res.profile.avatarUrlExpiresAt).toEqual(expect.any(String));

      const second = await upload(u, JPEG, 'image/jpeg');
      const abandoned = await upload(u); // picked, uploaded, never committed
      res = MeResponseSchema.parse((await u.as('put', '/me/avatar').send({ path: second.path }).expect(200)).body);
      expect(res.profile.avatarUrl).toContain(second.path);
      expect([...storage.objects.keys()]).toEqual([second.path]);
      expect(abandoned.path).not.toBe(second.path);
    });

    it('cannot commit another account\'s upload', async () => {
      const a = await user();
      const b = await user();
      const theirs = await upload(b);
      const res = await a.as('put', '/me/avatar').send({ path: theirs.path }).expect(422);
      expect(errorCode(res.body)).toBe('validation_failed');
      const meB = MeResponseSchema.parse((await b.as('get', '/me').expect(200)).body);
      expect(meB.profile.avatarUrl).toBeUndefined();
      expect(storage.objects.has(theirs.path)).toBe(true);
    });

    it('rejects unsupported types, missing uploads, oversize files and disguised files', async () => {
      const u = await user();
      await u.as('post', '/me/avatar/uploads').send({ contentType: 'image/gif' }).expect(422);
      await u.as('post', '/me/avatar/uploads').send({ contentType: 'text/html' }).expect(422);

      const missing = AvatarUploadSchema.parse((await u.as('post', '/me/avatar/uploads').send({ contentType: 'image/png' }).expect(201)).body);
      expect(errorCode((await u.as('put', '/me/avatar').send({ path: missing.path }).expect(404)).body)).toBe('not_found');

      const big = await upload(u);
      storage.objects.get(big.path)!.size = 6 * 1024 * 1024;
      await u.as('put', '/me/avatar').send({ path: big.path }).expect(422);
      expect(storage.objects.has(big.path)).toBe(false);

      const html = await upload(u, [...Buffer.from('<html><script>')], 'image/png');
      await u.as('put', '/me/avatar').send({ path: html.path }).expect(422);
      expect(storage.objects.has(html.path)).toBe(false);

      await u.as('put', '/me/avatar').send({ path: '../../etc/passwd' }).expect(422);
    });

    it('removes the photo', async () => {
      const u = await user();
      const slot = await upload(u);
      await u.as('put', '/me/avatar').send({ path: slot.path }).expect(200);
      const res = MeResponseSchema.parse((await u.as('delete', '/me/avatar').expect(200)).body);
      expect(res.profile.avatarUrl).toBeUndefined();
      expect(storage.objects.size).toBe(0);
    });

    it('says photos are unavailable when storage is down, without failing /me', async () => {
      const u = await user();
      const slot = await upload(u);
      await u.as('put', '/me/avatar').send({ path: slot.path }).expect(200);
      storage.createSignedUrl.mockRejectedValue(new Error('down'));
      const me = MeResponseSchema.parse((await u.as('get', '/me').expect(200)).body);
      expect(me.profile.avatarUrl).toBeUndefined();
    });
  });

  describe('account deletion', () => {
    it('removes the profile, the login and the photos together; the old token then stops working', async () => {
      const u = await user();
      const slot = AvatarUploadSchema.parse((await u.as('post', '/me/avatar/uploads').send({ contentType: 'image/png' }).expect(201)).body);
      storage.objects.set(slot.path, { bytes: PNG, size: 10, contentType: 'image/png' });
      await u.as('put', '/me/avatar').send({ path: slot.path }).expect(200);
      await u.as('patch', '/me/settings').send({ preciseLocation: false }).expect(200);

      await u.as('delete', '/me').expect(204);
      expect(db.profiles.size).toBe(0);
      expect(db.settings.size).toBe(0);
      expect(db.users.get(u.id)!.deleted).toBe(true);
      expect(storage.objects.size).toBe(0);
      await u.as('get', '/me').expect(401);
      expect(db.profiles.size).toBe(0);
    });

    it('refuses (and deletes nothing) while the account is part of shared plans — a B2 dependency', async () => {
      const u = await user();
      await u.as('get', '/me').expect(200);
      db.counts.members = 1;
      const res = await u.as('delete', '/me').expect(409);
      expect(errorCode(res.body)).toBe('conflict');
      expect(db.profiles.size).toBe(1);
      expect(db.users.get(u.id)!.deleted).toBe(false);
    });

    it('only ever deletes the caller', async () => {
      const a = await user();
      const b = await user();
      await b.as('get', '/me').expect(200);
      await a.as('delete', '/me').expect(204);
      expect(db.users.get(b.id)!.deleted).toBe(false);
      await b.as('get', '/me').expect(200);
    });
  });
});
