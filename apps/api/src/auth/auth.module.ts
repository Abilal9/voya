import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { AuthGuard } from './auth.guard';
import { JWT_KEY_SOURCE, remoteKeySource, SupabaseJwtVerifier } from './jwt-verifier';

/**
 * Supabase Auth verification. Voya never handles passwords: Supabase issues
 * the tokens, the API only verifies them against the public JWKS.
 */
@Module({
  providers: [
    { provide: JWT_KEY_SOURCE, inject: [ENV], useFactory: (env: Env) => remoteKeySource(env) },
    SupabaseJwtVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SupabaseJwtVerifier],
})
export class AuthModule {}
