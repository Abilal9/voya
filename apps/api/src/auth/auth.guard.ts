import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthContext } from '@voya/contracts';
import type { Request } from 'express';
import { AppError } from '../common/errors/app-error';
import { SupabaseJwtVerifier } from './jwt-verifier';
import { IS_PUBLIC } from './public.decorator';

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

/**
 * Global guard: every route needs `Authorization: Bearer <Supabase access
 * token>` unless marked @Public(). The verified identity is attached to the
 * request as `req.auth`; nothing about identity is read from the body.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: SupabaseJwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(req.headers.authorization);
    if (!token) throw AppError.unauthenticated();
    req.auth = await this.verifier.verify(token);
    return true;
  }
}

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return undefined;
  return token;
}
