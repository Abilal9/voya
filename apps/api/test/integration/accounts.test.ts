import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AccountPreferencesSchema, AvatarUploadSchema, MeResponseSchema } from '@voya/contracts';
import request from 'supertest';
import { createTestApp } from '../helpers';
import { authCall, latestEmail, localEnv, localStatus, signIn, signUpTestUser, type TestUser } from './local-stack';

/**
 * B1 end to end against the real local stack: Supabase Auth (sign-up with the
 * emailed code, password sign-in, refresh, sign-out, recovery), the API,
 * Postgres and Storage. Nothing is mocked.
 */
describe('B1 accounts against the local Supabase stack', () => {
  const env = localEnv();
  const prisma = new PrismaClient();
  const run = Date.now();
  const emailFor = (who: string) => `it-b1-${who}-${run}@example.com`;
  let app: INestApplication;

  const api = (user: Pick<TestUser, 'accessToken'>) => {
    const as = (method: 'get' | 'patch' | 'put' | 'post' | 'delete', path: string) =>
      request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.accessToken}`);
    return as;
  };

  beforeAll(async () => {
    app = await createTestApp({ env });
  });

  afterAll(async () => {
    const ids = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM auth.users WHERE email LIKE ${`it-b1-%-${run}@example.com`}`;
    await prisma.profile.deleteMany({ where: { authUserId: { in: ids.map((r) => r.id) } } });
    await prisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE ${`it-b1-%-${run}@example.com`}`;
    await app.close();
    await prisma.$disconnect();
  });

  it('signs up with the emailed 6-digit code, then provisions the profile from the sign-up names', async () => {
    const email = emailFor('signup');
    const password = 'Voya-test-123';
    const signUp = await authCall(env, '/signup', { email, password, data: { first_name: 'Reem', last_name: 'Fahad' } });
    expect(signUp.status).toBe(200);
    expect(signUp.body.access_token).toBeUndefined(); // no session until the email is verified

    const blocked = await authCall(env, '/token?grant_type=password', { email, password });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error_code).toBe('email_not_confirmed');

    const mail = await latestEmail(email);
    expect(mail.subject).toBe('Your Voya verification code');
    const code = /\b(\d{6})\b/.exec(mail.text)?.[1];
    expect(code).toBeDefined();

    expect((await authCall(env, '/verify', { type: 'email', email, token: '000000' })).status).not.toBe(200);
    const verified = await authCall(env, '/verify', { type: 'email', email, token: code });
    expect(verified.status).toBe(200);
    const accessToken = verified.body.access_token as string;

    const me = MeResponseSchema.parse((await api({ accessToken })('get', '/me').expect(200)).body);
    expect(me.profile).toMatchObject({ firstName: 'Reem', lastName: 'Fahad', displayName: 'Reem Fahad', onboardingStep: 'profile' });
    expect(me.auth.email).toBe(email);
  });

  it('rejects a wrong password and an unknown account the same way', async () => {
    const user = await signUpTestUser(env, emailFor('pw'));
    const wrong = await authCall(env, '/token?grant_type=password', { email: user.email, password: 'nope-nope-1' });
    const unknown = await authCall(env, '/token?grant_type=password', { email: emailFor('nobody'), password: 'nope-nope-1' });
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(wrong.body.error_code).toBe('invalid_credentials');
    expect(unknown.body.error_code).toBe('invalid_credentials');
  });

  it('updates and reads back the profile, interests, onboarding and settings — and they survive an API restart', async () => {
    const user = await signUpTestUser(env, emailFor('persist'), { first_name: 'Hind' });
    const as = api(user);
    await as('patch', '/me').send({ lastName: 'Saleh', city: 'Riyadh', bio: 'Weekend padel.' }).expect(200);
    await as('put', '/me/interests').send({ interests: ['Coffee', 'Padel'] }).expect(200);
    await as('post', '/me/onboarding').send({ step: 'profile' }).expect(200);
    await as('patch', '/me/settings').send({ notifications: { productUpdates: true }, discoveryRadiusKm: 25 }).expect(200);

    await app.close();
    app = await createTestApp({ env });

    const me = MeResponseSchema.parse((await api(user)('get', '/me').expect(200)).body);
    expect(me.profile).toMatchObject({
      firstName: 'Hind', lastName: 'Saleh', displayName: 'Hind Saleh', city: 'Riyadh', bio: 'Weekend padel.',
      interests: ['Coffee', 'Padel'], onboardingStep: 'interests',
    });
    const settings = AccountPreferencesSchema.parse((await api(user)('get', '/me/settings').expect(200)).body);
    expect(settings).toMatchObject({ discoveryRadiusKm: 25, notifications: { productUpdates: true, planChanges: true } });
  });

  it('keeps accounts apart: another account cannot read or change this one', async () => {
    const a = await signUpTestUser(env, emailFor('iso-a'), { first_name: 'Asma' });
    const b = await signUpTestUser(env, emailFor('iso-b'), { first_name: 'Bader' });
    const meA = MeResponseSchema.parse((await api(a)('get', '/me').expect(200)).body);
    await api(b)('patch', '/me').send({ firstName: 'Changed' }).expect(200);
    await api(b)('patch', `/me/${meA.profile.id}`).send({ firstName: 'Hacked' }).expect(404);
    const again = MeResponseSchema.parse((await api(a)('get', '/me').expect(200)).body);
    expect(again.profile.firstName).toBe('Asma');
    expect((await prisma.profile.findUnique({ where: { id: meA.profile.id } }))?.firstName).toBe('Asma');
  });

  it('refreshes a session, and a signed-out session stops working at once', async () => {
    const user = await signUpTestUser(env, emailFor('session'));
    const refreshed = await authCall(env, '/token?grant_type=refresh_token', { refresh_token: user.refreshToken });
    expect(refreshed.status).toBe(200);
    const fresh = { accessToken: refreshed.body.access_token as string };
    await api(fresh)('get', '/me').expect(200);

    expect((await authCall(env, '/logout?scope=local', {}, fresh.accessToken)).status).toBe(204);
    const res = await api(fresh)('get', '/me').expect(401);
    expect(res.body.error.code).toBe('unauthenticated');
    // The used refresh token was rotated and the session is gone: no silent way back in.
    expect((await authCall(env, '/token?grant_type=refresh_token', { refresh_token: user.refreshToken })).status).toBe(400);
  });

  it('resets a password through the emailed recovery link', async () => {
    const user = await signUpTestUser(env, emailFor('recover'));
    const redirect = 'voya://set-password';
    const asked = await authCall(env, `/recover?redirect_to=${encodeURIComponent(redirect)}`, { email: user.email });
    expect(asked.status).toBe(200);
    const mail = await latestEmail(user.email);
    expect(mail.subject).toBe('Reset your Voya password');
    const link = /href="([^"]+)"/.exec(mail.html)?.[1]?.replace(/&amp;/g, '&');
    expect(link).toContain('type=recovery');

    const opened = await fetch(link!, { redirect: 'manual' });
    const location = opened.headers.get('location') ?? '';
    expect(location.startsWith(redirect)).toBe(true);
    const recoveryToken = new URLSearchParams(location.split('#')[1]).get('access_token');
    expect(recoveryToken).toBeTruthy();

    const newPassword = 'Brand-new-pass-9';
    const changed = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: localStatus().anonKey, authorization: `Bearer ${recoveryToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    expect(changed.status).toBe(200);
    await expect(signIn(env, user.email, user.password)).rejects.toThrow();
    await expect(signIn(env, user.email, newPassword)).resolves.toMatchObject({ userId: user.userId });
  });

  describe('avatars in the private bucket', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ffbf1e0005fe02fea7d2a4c90000000049454e44ae426082', 'hex');

    async function uploadAvatar(user: TestUser, bytes = png, contentType = 'image/png') {
      const slot = AvatarUploadSchema.parse(
        (await api(user)('post', '/me/avatar/uploads').send({ contentType }).expect(201)).body,
      );
      const put = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'content-type': contentType }, body: bytes });
      return { slot, status: put.status };
    }

    it('uploads, commits, serves through a signed URL only, and replaces without leaving the old file', async () => {
      const user = await signUpTestUser(env, emailFor('avatar'));
      const first = await uploadAvatar(user);
      expect(first.status).toBe(200);
      let me = MeResponseSchema.parse((await api(user)('put', '/me/avatar').send({ path: first.slot.path }).expect(200)).body);
      const signed = await fetch(me.profile.avatarUrl!);
      expect(signed.status).toBe(200);
      expect(Buffer.from(await signed.arrayBuffer()).equals(png)).toBe(true);

      // The bucket is private: no public URL, and the app's public key cannot read it.
      const pub = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public/avatars/${first.slot.path}`);
      expect(pub.ok).toBe(false);
      const anon = await fetch(`${env.SUPABASE_URL}/storage/v1/object/authenticated/avatars/${first.slot.path}`, {
        headers: { apikey: localStatus().anonKey, authorization: `Bearer ${user.accessToken}` },
      });
      expect(anon.ok).toBe(false);

      const second = await uploadAvatar(user);
      me = MeResponseSchema.parse((await api(user)('put', '/me/avatar').send({ path: second.slot.path }).expect(200)).body);
      expect(me.profile.avatarUrl).toContain(second.slot.path);
      const gone = await fetch(`${env.SUPABASE_URL}/storage/v1/object/info/avatars/${first.slot.path}`, {
        headers: { apikey: localStatus().secretKey },
      });
      expect(gone.ok).toBe(false);
    });

    it('refuses another account\'s upload, a disguised file and a type the bucket does not take', async () => {
      const a = await signUpTestUser(env, emailFor('avatar-a'));
      const b = await signUpTestUser(env, emailFor('avatar-b'));
      const theirs = await uploadAvatar(b);
      await api(a)('put', '/me/avatar').send({ path: theirs.slot.path }).expect(422);

      const fake = await uploadAvatar(a, Buffer.from('<html><script>alert(1)</script></html>'), 'image/png');
      expect(fake.status).toBe(200); // storage trusts the declared type…
      await api(a)('put', '/me/avatar').send({ path: fake.slot.path }).expect(422); // …the API does not

      // A signed upload URL is bound to its path and content rules: storage refuses other types.
      const slot = AvatarUploadSchema.parse((await api(a)('post', '/me/avatar/uploads').send({ contentType: 'image/png' }).expect(201)).body);
      const html = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'content-type': 'text/html' }, body: '<p>x</p>' });
      expect(html.ok).toBe(false);
    });
  });

  it('deletes the account: profile, login and photos go together, and the old token stops working', async () => {
    const user = await signUpTestUser(env, emailFor('delete'));
    const as = api(user);
    const me = MeResponseSchema.parse((await as('get', '/me').expect(200)).body);
    await as('patch', '/me/settings').send({ preciseLocation: false }).expect(200);

    await as('delete', '/me').expect(204);
    expect(await prisma.profile.count({ where: { id: me.profile.id } })).toBe(0);
    expect(await prisma.accountSettings.count({ where: { profileId: me.profile.id } })).toBe(0);
    const [left] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auth.users WHERE id = ${user.userId}::uuid`;
    expect(Number(left?.n)).toBe(0);
    await as('get', '/me').expect(401);
    expect(await prisma.profile.count({ where: { authUserId: user.userId } })).toBe(0);
    await expect(signIn(env, user.email, user.password)).rejects.toThrow();
  });
});
