import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import { AVATAR_MAX_BYTES, AVATAR_CONTENT_TYPES, type AvatarUpload } from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { StorageClient } from '../storage/storage.client';

export const AVATAR_BUCKET = 'avatars';

type AvatarType = (typeof AVATAR_CONTENT_TYPES)[number];
const EXTENSION: Record<AvatarType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** `<profile id>/<uuid>.<ext>` — the only shape of path this service accepts. */
const PATH = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp|heic)$/;

/**
 * Profile photos in the private `avatars` bucket.
 *
 * Flow: the app asks for a signed upload URL (scoped by the server to a fresh
 * path inside the caller's own folder), PUTs the image there directly, then
 * commits the path. Commit checks the path is the caller's, the object
 * exists, is within the size limit and really is an image of an accepted
 * type (magic bytes, not just the declared Content-Type), then swaps it in
 * and removes every other object in the caller's folder — the previous photo
 * and any abandoned uploads — so nothing is left orphaned.
 *
 * Photos are read through short-lived signed URLs; the bucket stays private
 * and the app never holds a Storage key.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly storage: StorageClient,
  ) {}

  async createUpload(profile: Profile, contentType: AvatarType): Promise<AvatarUpload> {
    const path = `${profile.id}/${randomUUID()}.${EXTENSION[contentType]}`;
    const uploadUrl = await this.storage.createSignedUploadUrl(AVATAR_BUCKET, path);
    return { path, uploadUrl, contentType, maxBytes: AVATAR_MAX_BYTES };
  }

  async commit(profile: Profile, path: string): Promise<Profile> {
    const match = PATH.exec(path);
    // Another person's folder is reported exactly like a malformed path.
    if (!match || match[1] !== profile.id) {
      throw new AppError('validation_failed', 'That photo could not be used.', [{ path: 'body.path', message: 'Not an upload of yours' }]);
    }
    const info = await this.storage.info(AVATAR_BUCKET, path);
    if (!info) throw new AppError('not_found', 'That photo upload was not found. Try again.');
    if (info.size <= 0 || info.size > AVATAR_MAX_BYTES) {
      await this.discard([path]);
      throw new AppError('validation_failed', 'That photo is too large. Choose one under 5 MB.');
    }
    const kind = sniffImage(await this.storage.head(AVATAR_BUCKET, path, 16));
    if (!kind || EXTENSION[kind] !== match[3]) {
      await this.discard([path]);
      throw new AppError('validation_failed', 'That file is not a supported photo.');
    }
    const updated = await this.prisma.profile.update({ where: { id: profile.id }, data: { avatarPath: path } });
    await this.removeOthers(profile.id, path);
    return updated;
  }

  async clear(profile: Profile): Promise<Profile> {
    const updated = await this.prisma.profile.update({ where: { id: profile.id }, data: { avatarPath: null } });
    await this.removeOthers(profile.id, null);
    return updated;
  }

  /** A signed URL for display, or nothing if storage is unavailable (the app shows initials). */
  async signedUrl(path: string): Promise<{ url: string; expiresAt: string } | undefined> {
    if (!this.storage.configured) return undefined;
    try {
      const ttl = this.env.AVATAR_URL_TTL_SECONDS;
      const url = await this.storage.createSignedUrl(AVATAR_BUCKET, path, ttl);
      return { url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    } catch {
      return undefined;
    }
  }

  /** Deletes every object in the profile's folder except `keep`. Best effort: never fails the request. */
  async removeOthers(profileId: string, keep: string | null): Promise<void> {
    try {
      const paths = await this.storage.list(AVATAR_BUCKET, profileId);
      await this.storage.remove(AVATAR_BUCKET, paths.filter((p) => p !== keep));
    } catch {
      this.logger.warn({ profileId }, 'avatar clean-up deferred: storage unavailable');
    }
  }

  private async discard(paths: string[]) {
    try {
      await this.storage.remove(AVATAR_BUCKET, paths);
    } catch {
      // The next successful commit removes it.
    }
  }
}

/** Identifies an image from its first bytes; undefined for anything else. */
export function sniffImage(bytes: Uint8Array): AvatarType | undefined {
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  const ascii = (i: number, text: string) => at(i, ...[...text].map((c) => c.charCodeAt(0)));
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  if (ascii(4, 'ftyp') && ['heic', 'heix', 'mif1', 'msf1', 'heis', 'hevc'].some((b) => ascii(8, b))) return 'image/heic';
  return undefined;
}
