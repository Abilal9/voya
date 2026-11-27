import { Inject, Injectable } from '@nestjs/common';
import { AuthContextSchema, type AuthContext } from '@voya/contracts';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { AppError } from '../common/errors/app-error';

/** Resolves the public key for a token. Remote JWKS in the app; a local set in tests. */
export const JWT_KEY_SOURCE = Symbol('JWT_KEY_SOURCE');

/**
 * Asymmetric algorithms only. A symmetric (HS256) token would mean the API
 * holds Supabase's signing secret, which it deliberately never does.
 */
const ALGORITHMS = ['ES256', 'RS256'];

export function remoteKeySource(env: Env): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
    timeoutDuration: 3_000,
  });
}

/** Claims Supabase puts in an access token that Voya reads. */
interface SupabaseClaims extends JWTPayload {
  email?: string;
  role?: string;
  session_id?: string;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
}

/** A sign-up name from user metadata: a short single-line string, or nothing. */
function metadataName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, 40) : undefined;
}

/**
 * Verifies a Supabase Auth access token: signature against the project's
 * JWKS, issuer, audience, expiry, and that it belongs to a signed-in user
 * (role `authenticated`, UUID subject). Returns the caller's AuthContext.
 */
@Injectable()
export class SupabaseJwtVerifier {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(JWT_KEY_SOURCE) private readonly keys: JWTVerifyGetKey,
  ) {}

  async verify(token: string): Promise<AuthContext> {
    let payload: SupabaseClaims;
    try {
      ({ payload } = await jwtVerify<SupabaseClaims>(token, this.keys, {
        algorithms: ALGORITHMS,
        issuer: this.env.SUPABASE_JWT_ISSUER,
        audience: this.env.SUPABASE_JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp'],
        clockTolerance: 5,
      }));
    } catch (error) {
      throw toAuthError(error);
    }

    // Anonymous sign-ins are disabled; refuse them even if a project enables them.
    if (payload.role !== 'authenticated' || payload.is_anonymous === true) {
      throw AppError.unauthenticated();
    }
    const metadata = payload.user_metadata ?? {};
    const firstName = metadataName(metadata.first_name);
    const lastName = metadataName(metadata.last_name);
    const context = AuthContextSchema.safeParse({
      authUserId: payload.sub,
      email: payload.email || undefined,
      role: payload.role,
      sessionId: payload.session_id,
      signUpNames: firstName || lastName ? { firstName, lastName } : undefined,
    });
    if (!context.success) throw AppError.unauthenticated();
    return context.data;
  }
}

/** Bad or expired tokens are 401; failing to fetch the key set is a 503. */
function toAuthError(error: unknown): AppError {
  if (error instanceof errors.JWTExpired) {
    return AppError.unauthenticated('Your session has expired. Sign in again.');
  }
  if (error instanceof errors.JWKSTimeout || (error instanceof TypeError && /fetch/i.test(error.message))) {
    return new AppError('unavailable', 'Sign-in is temporarily unavailable. Try again shortly.');
  }
  return AppError.unauthenticated();
}
