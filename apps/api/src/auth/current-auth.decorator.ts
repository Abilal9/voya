import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import type { AuthenticatedRequest } from './auth.guard';

/** The verified caller. Only valid on routes behind the auth guard. */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const auth = ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  if (!auth) throw AppError.unauthenticated();
  return auth;
});
