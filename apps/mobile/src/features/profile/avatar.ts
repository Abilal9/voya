import { File, Paths } from 'expo-file-system';

/**
 * Turns a stored avatar reference into a displayable URI, or undefined when the
 * file is missing (deleted, reinstalled), so the UI falls back to initials.
 */
export function avatarUri(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  try {
    const file = new File(Paths.document, ref);
    return file.exists ? file.uri : undefined;
  } catch {
    return undefined;
  }
}

export function initialsOf(first?: string, last?: string) {
  if (!first) return '';
  return `${first[0] ?? ''}${last?.[0] ?? first[1] ?? ''}`.toUpperCase();
}
