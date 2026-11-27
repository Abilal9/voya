import { ERROR_RETRYABLE, ERROR_STATUS, type ErrorCode, type ValidationIssue } from '@voya/contracts';

/**
 * An expected failure with a stable code and a message that is safe to show.
 * Throw this from services; the global filter turns it into the API error
 * envelope. Anything else that escapes becomes a generic `internal` error.
 */
export class AppError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly issues?: ValidationIssue[],
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_STATUS[code];
    this.retryable = ERROR_RETRYABLE[code];
  }

  static notFound(what: string): AppError {
    return new AppError('not_found', `${what} was not found.`);
  }

  static unauthenticated(message = 'Sign in to continue.'): AppError {
    return new AppError('unauthenticated', message);
  }

  static forbidden(message = 'You do not have access to this.'): AppError {
    return new AppError('forbidden', message);
  }
}
