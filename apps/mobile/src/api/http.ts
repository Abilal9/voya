import { ApiErrorSchema } from '@voya/contracts';
import type { ZodType, ZodTypeDef } from 'zod';
import { ServiceError } from '@/services/types';

/**
 * Typed calls to the Voya API. Every response is validated against its shared
 * contract; anything unexpected becomes a ServiceError with a message that is
 * safe to show — never a raw body, status line or stack.
 *
 * The access token is fetched per call from the Supabase client (which
 * refreshes it when it is about to expire). A 401 means the session is over:
 * `onUnauthenticated` signs the device out before the error reaches the UI.
 */
export interface ApiClientOptions {
  baseUrl: string;
  accessToken: () => Promise<string | null>;
  onUnauthenticated: () => Promise<void>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export const OFFLINE = () => new ServiceError('offline', 'You appear to be offline.', true);
const UNAVAILABLE = () => new ServiceError('unavailable', 'Voya is not reachable right now. Try again shortly.', true);
const SIGNED_OUT = () => new ServiceError('unauthenticated', 'Your session has ended. Sign in again.', false);

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');

  async function call<T>(
    method: Method,
    path: string,
    schema: ZodType<T, ZodTypeDef, unknown> | null,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const token = await options.accessToken();
    if (!token) {
      await options.onUnauthenticated();
      throw SIGNED_OUT();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    let res: Response;
    try {
      res = await doFetch(`${base}/api/v1${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw OFFLINE();
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401) {
      await options.onUnauthenticated();
      throw SIGNED_OUT();
    }
    const payload = await readJson(res);
    if (!res.ok) throw toServiceError(res.status, payload);
    if (schema === null) return undefined as T;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw UNAVAILABLE();
    return parsed.data;
  }

  return { call };
}

export type ApiClient = ReturnType<typeof createApiClient>;

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** The server's own envelope carries a safe message; anything else gets a generic one. */
export function toServiceError(status: number, payload: unknown): ServiceError {
  const envelope = ApiErrorSchema.safeParse(payload);
  if (envelope.success) {
    const { code, message, retryable } = envelope.data.error;
    return new ServiceError(code, message, retryable);
  }
  if (status >= 500) return UNAVAILABLE();
  return new ServiceError('bad_request', 'Something went wrong. Try again.', false);
}
