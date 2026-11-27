import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { AppError } from '../common/errors/app-error';

export interface StoredObject {
  size: number;
  contentType: string | undefined;
}

/**
 * Minimal server-side Supabase Storage client (five REST calls, no SDK).
 * It holds the secret key, so every bucket and path it is given must come
 * from server code — never straight from a request.
 *
 * Without `SUPABASE_SECRET_KEY` (allowed outside production) every call
 * fails with `unavailable`, so photo features say so instead of pretending.
 */
@Injectable()
export class StorageClient {
  private readonly logger = new Logger(StorageClient.name);
  private readonly base: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.base = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1`;
  }

  get configured(): boolean {
    return !!this.env.SUPABASE_SECRET_KEY;
  }

  /** A one-off URL a client can PUT one object to (Supabase: valid for 2 hours, no overwrite). */
  async createSignedUploadUrl(bucket: string, path: string): Promise<string> {
    const body = await this.call<{ url: string }>('POST', `/object/upload/sign/${bucket}/${encodePath(path)}`, {});
    return `${this.base}${body.url}`;
  }

  /** A time-limited download URL for a private object. */
  async createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string> {
    const body = await this.call<{ signedURL: string }>('POST', `/object/sign/${bucket}/${encodePath(path)}`, { expiresIn });
    return `${this.base}${body.signedURL}`;
  }

  /** Size and type of an object, or null when it does not exist. */
  async info(bucket: string, path: string): Promise<StoredObject | null> {
    const res = await this.fetch('GET', `/object/info/${bucket}/${encodePath(path)}`);
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw this.failure('info', res.status);
    const body = (await res.json()) as { size?: number; content_type?: string };
    return { size: body.size ?? 0, contentType: body.content_type };
  }

  /** The first `count` bytes of an object (to check what it really is). */
  async head(bucket: string, path: string, count: number): Promise<Uint8Array> {
    const res = await this.fetch('GET', `/object/authenticated/${bucket}/${encodePath(path)}`, undefined, {
      Range: `bytes=0-${count - 1}`,
    });
    if (!res.ok) throw this.failure('head', res.status);
    return new Uint8Array(await res.arrayBuffer()).slice(0, count);
  }

  /** Object names directly under `prefix/`. */
  async list(bucket: string, prefix: string): Promise<string[]> {
    const rows = await this.call<{ name: string; id: string | null }[]>('POST', `/object/list/${bucket}`, {
      prefix,
      limit: 1000,
      offset: 0,
    });
    // Rows with a null id are folders.
    return rows.filter((r) => r.id !== null).map((r) => `${prefix}/${r.name}`);
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.call('DELETE', `/object/${bucket}`, { prefixes: paths });
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetch(method, path, body);
    if (!res.ok) throw this.failure(path.split('/')[1] ?? 'call', res.status);
    return (await res.json()) as T;
  }

  private async fetch(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const key = this.env.SUPABASE_SECRET_KEY;
    if (!key) throw new AppError('unavailable', 'Photos are not available right now.');
    try {
      return await fetch(`${this.base}${path}`, {
        method,
        headers: {
          apikey: key,
          // The legacy service_role key is a JWT and also goes in Authorization; sb_secret_ keys do not.
          ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      this.logger.warn({ op: path.split('/')[1], err: (error as Error).name }, 'storage request failed');
      throw new AppError('unavailable', 'Photos are not available right now. Try again shortly.');
    }
  }

  private failure(op: string, status: number): AppError {
    // Status only: storage error bodies can echo paths and are never forwarded.
    this.logger.warn({ op, status }, 'storage request rejected');
    return new AppError('unavailable', 'Photos are not available right now. Try again shortly.');
  }
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
