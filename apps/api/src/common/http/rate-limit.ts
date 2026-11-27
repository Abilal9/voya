import { applyDecorators, type CanActivate, type ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/auth.guard';
import { AppError } from '../errors/app-error';

/**
 * Per-caller limits on the endpoints worth abusing: opening invitation links,
 * creating links and in-app invitations, avatar uploads and account deletion.
 * Normal use never comes near them; they cap scripted abuse of one account.
 *
 * Fixed windows kept in process memory, keyed by the verified account (or the
 * client IP on a route without a token). That is exact for one API instance,
 * which is what staging runs; several replicas would each keep their own
 * count (a shared store comes with horizontal scaling, not before).
 */
export const RATE_LIMITS = {
  /** POST /invitations/resolve and /accept (shared bucket). */
  invitationOpen: { limit: 30, windowMs: 10 * 60_000 },
  /** POST /plans/:id/invitations */
  invitationCreate: { limit: 30, windowMs: 60 * 60_000 },
  /** POST /plans/:id/invitees */
  invite: { limit: 60, windowMs: 60 * 60_000 },
  /** POST /me/avatar/uploads */
  avatarUpload: { limit: 30, windowMs: 60 * 60_000 },
  /** DELETE /me */
  accountDelete: { limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, { limit: number; windowMs: number }>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

const BUCKET = 'voya:rate-limit-bucket';
const MAX_KEYS = 50_000;

/** In-memory fixed-window counter. `now` is injectable for tests. */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  /** Counts one hit; returns the seconds to wait when over the limit, else 0. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): number {
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      if (this.windows.size >= MAX_KEYS) this.sweep(now);
      window = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    return window.count > limit ? Math.max(1, Math.ceil((window.resetAt - now) / 1000)) : 0;
  }

  reset(): void {
    this.windows.clear();
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
    // Still full of live windows: drop the oldest rather than grow without bound.
    if (this.windows.size >= MAX_KEYS) this.windows.delete(this.windows.keys().next().value as string);
  }
}

/** One counter for the process, shared by every module that applies a limit. */
export const rateLimiter = new FixedWindowLimiter();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const bucket = this.reflector.get<RateLimitBucket | undefined>(BUCKET, context.getHandler());
    if (!bucket) return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Runs after the global AuthGuard, so a verified account id is available on authenticated routes.
    const who = req.auth?.authUserId ?? `ip:${req.ip ?? 'unknown'}`;
    const { limit, windowMs } = RATE_LIMITS[bucket];
    const waitSeconds = rateLimiter.hit(`${bucket}:${who}`, limit, windowMs);
    if (waitSeconds > 0) {
      context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(waitSeconds));
      throw new AppError('rate_limited', 'Too many requests. Try again shortly.');
    }
    return true;
  }
}

/** Applies the named limit to one route handler. */
export const RateLimit = (bucket: RateLimitBucket) => applyDecorators(SetMetadata(BUCKET, bucket), UseGuards(RateLimitGuard));
