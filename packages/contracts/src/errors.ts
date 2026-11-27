import { z } from 'zod';

/**
 * Every non-2xx API response has this body. `code` is stable and machine
 * readable; `message` is safe to show and never contains internals (stack
 * traces, SQL, provider payloads). It maps 1:1 onto the mobile app's
 * `ServiceError(code, message, retryable)`.
 */
export const ERROR_CODES = [
  'validation_failed',
  'bad_request',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  /** An invitation link past its expiry. */
  'expired',
  /** An invitation link its plan withdrew. */
  'revoked',
  'rate_limited',
  'unavailable',
  'internal',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ValidationIssueSchema = z.object({
  /** Dotted path into the request part that failed, e.g. `query.limit`. */
  path: z.string(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    /** Correlation id; also returned as the `x-request-id` header. */
    requestId: z.string().optional(),
    issues: z.array(ValidationIssueSchema).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** HTTP status for each code. Kept here so clients and server agree. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  validation_failed: 422,
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  expired: 410,
  revoked: 410,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

/** Whether a client may retry the same request unchanged. */
export const ERROR_RETRYABLE: Record<ErrorCode, boolean> = {
  validation_failed: false,
  bad_request: false,
  unauthenticated: false,
  forbidden: false,
  not_found: false,
  conflict: false,
  expired: false,
  revoked: false,
  rate_limited: true,
  unavailable: true,
  internal: true,
};
