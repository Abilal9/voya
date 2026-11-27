import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_RETRYABLE, ERROR_STATUS, type ApiError, type ErrorCode } from '@voya/contracts';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppError } from './app-error';

const HTTP_STATUS_CODES: Record<number, ErrorCode> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'bad_request',
  415: 'bad_request',
  422: 'validation_failed',
  429: 'rate_limited',
  503: 'unavailable',
};

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  validation_failed: 'Some of the details are not valid.',
  bad_request: 'The request could not be understood.',
  unauthenticated: 'Sign in to continue.',
  forbidden: 'You do not have access to this.',
  not_found: 'Not found.',
  conflict: 'Someone else changed this. Refresh and try again.',
  expired: 'This invitation has expired.',
  revoked: 'This invitation was withdrawn.',
  rate_limited: 'Too many requests. Try again shortly.',
  unavailable: 'Voya is temporarily unavailable. Try again shortly.',
  internal: 'Something went wrong on our side.',
};

/** Prisma error codes that mean "the database is not reachable right now". */
const PRISMA_UNAVAILABLE = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/**
 * Turns every thrown value into the ApiError envelope. Messages are chosen
 * here, from codes, so driver errors, SQL and stack traces never reach a
 * client. Unexpected errors are logged with the request id.
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger('Errors') private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const { code, message, issues } = this.describe(exception, req);

    const body: ApiError = {
      error: {
        code,
        message,
        retryable: ERROR_RETRYABLE[code],
        requestId: typeof req.id === 'string' ? req.id : undefined,
        ...(issues ? { issues } : {}),
      },
    };
    if ((code === 'rate_limited' || code === 'unavailable') && !res.getHeader('Retry-After')) res.setHeader('Retry-After', '5');
    res.status(ERROR_STATUS[code]).json(body);
  }

  private describe(exception: unknown, req: Request): Pick<ApiError['error'], 'code' | 'message' | 'issues'> {
    if (exception instanceof AppError) {
      return { code: exception.code, message: exception.message, issues: exception.issues };
    }
    if (exception instanceof HttpException) {
      const code = HTTP_STATUS_CODES[exception.getStatus()] ?? (exception.getStatus() >= 500 ? 'internal' : 'bad_request');
      if (code === 'internal') this.logUnexpected(exception, req);
      return { code, message: SAFE_MESSAGES[code] };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return { code: 'not_found', message: SAFE_MESSAGES.not_found };
      if (exception.code === 'P2002') return { code: 'conflict', message: 'That already exists.' };
      if (PRISMA_UNAVAILABLE.has(exception.code)) {
        this.logger.warn({ prismaCode: exception.code, reqId: (req as { id?: string }).id }, 'Database unavailable');
        return { code: 'unavailable', message: SAFE_MESSAGES.unavailable };
      }
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.warn({ reqId: (req as { id?: string }).id }, 'Database unavailable');
      return { code: 'unavailable', message: SAFE_MESSAGES.unavailable };
    }
    this.logUnexpected(exception, req);
    return { code: 'internal', message: SAFE_MESSAGES.internal };
  }

  private logUnexpected(exception: unknown, req: Request): void {
    this.logger.error(
      { err: exception, reqId: (req as { id?: string }).id, method: req.method, url: req.originalUrl },
      'Unhandled error',
    );
  }
}
