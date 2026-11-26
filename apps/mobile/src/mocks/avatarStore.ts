import { Directory, File, Paths } from 'expo-file-system';

/**
 * Mock "upload" for profile photos: copies the picked image into the app's
 * document directory so it survives restarts (picker URIs are temporary).
 * Only a short relative reference is kept in account state, never image data.
 * Later this is replaced by an upload to real storage.
 */
const FOLDER = 'avatars';

export function saveAvatar(localUri: string, accountId: string): string {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = (localUri.split('?')[0]!.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4);
  const name = `${accountId}-${Date.now()}.${ext}`;
  new File(localUri).copy(new File(dir, name));
  return `${FOLDER}/${name}`;
}

export function removeAvatar(ref: string | undefined) {
  if (!ref) return;
  try {
    const file = new File(Paths.document, ref);
    if (file.exists) file.delete();
  } catch {
    // A missing file is already gone.
  }
}

const COVERS = 'covers';

/** Copies a picked event cover into app storage; the plan stores the reference only. */
export function saveCover(localUri: string, eventId: string): string {
  const dir = new Directory(Paths.document, COVERS);
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = (localUri.split('?')[0]!.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4);
  const name = `${eventId}-${Date.now()}.${ext}`;
  new File(localUri).copy(new File(dir, name));
  return `${COVERS}/${name}`;
}

export const removeCover = removeAvatar;
