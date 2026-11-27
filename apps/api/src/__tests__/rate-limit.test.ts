import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FixedWindowLimiter, RATE_LIMITS, RateLimit, RateLimitGuard, rateLimiter } from '../common/http/rate-limit';
import { AppError } from '../common/errors/app-error';

describe('FixedWindowLimiter', () => {
  it('allows the limit, refuses the next hit, and opens a new window after it ends', () => {
    const limiter = new FixedWindowLimiter();
    for (let i = 0; i < 3; i++) expect(limiter.hit('k', 3, 60_000, 1_000)).toBe(0);
    expect(limiter.hit('k', 3, 60_000, 31_000)).toBe(30);
    expect(limiter.hit('other', 3, 60_000, 31_000)).toBe(0);
    expect(limiter.hit('k', 3, 60_000, 61_000)).toBe(0);
  });
});

describe('RateLimitGuard', () => {
  class Routes {
    @RateLimit('accountDelete')
    remove(): void {}
    open(): void {}
  }

  const context = (handler: () => void, req: object, headers: Record<string, string>) =>
    ({
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ setHeader: (k: string, v: string) => (headers[k] = v) }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => rateLimiter.reset());

  it('counts per verified account and answers rate_limited with Retry-After', () => {
    const guard = new RateLimitGuard(new Reflector());
    const headers: Record<string, string> = {};
    const alice = { auth: { authUserId: 'alice' }, ip: '1.1.1.1' };
    const bob = { auth: { authUserId: 'bob' }, ip: '1.1.1.1' };
    for (let i = 0; i < RATE_LIMITS.accountDelete.limit; i++) {
      expect(guard.canActivate(context(Routes.prototype.remove, alice, headers))).toBe(true);
    }
    let error: unknown;
    try {
      guard.canActivate(context(Routes.prototype.remove, alice, headers));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('rate_limited');
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    // Same IP, different account: its own budget.
    expect(guard.canActivate(context(Routes.prototype.remove, bob, headers))).toBe(true);
  });

  it('leaves routes without a limit alone', () => {
    const guard = new RateLimitGuard(new Reflector());
    for (let i = 0; i < 100; i++) expect(guard.canActivate(context(Routes.prototype.open, {}, {}))).toBe(true);
  });
});
