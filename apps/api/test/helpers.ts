import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWTVerifyGetKey } from 'jose';
import { AppModule } from '../src/app.module';
import { JWT_KEY_SOURCE } from '../src/auth/jwt-verifier';
import { configureApp } from '../src/bootstrap';
import { loadEnv, type Env } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

export const TEST_SUPABASE_URL = 'http://supabase.test';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/unused',
    SUPABASE_URL: TEST_SUPABASE_URL,
    ...overrides,
  });
}

/** A local ES256 key pair standing in for Supabase Auth's signing key. */
export async function testSigner() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, options: { expiresIn?: string | number; issuer?: string; audience?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(options.issuer ?? `${TEST_SUPABASE_URL}/auth/v1`)
      .setAudience(options.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(privateKey);
  return { keys, sign };
}

/** The real app wiring with the database and the JWKS replaced. */
export async function createTestApp(options: {
  env?: Env;
  prisma?: unknown;
  keys?: JWTVerifyGetKey;
}): Promise<INestApplication> {
  const env = options.env ?? testEnv();
  let builder = Test.createTestingModule({ imports: [AppModule.forRoot(env)] });
  if (options.prisma) builder = builder.overrideProvider(PrismaService).useValue(options.prisma);
  if (options.keys) builder = builder.overrideProvider(JWT_KEY_SOURCE).useValue(options.keys);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureApp(app, env);
  await app.init();
  return app;
}
