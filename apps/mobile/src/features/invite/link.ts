/**
 * The development invitation path, `/invite/<token>`. Tokens are the mock
 * service's fixture tokens; real ones (and voya.events links) come from the
 * backend later. Returns undefined for anything that isn't that shape.
 */
export function inviteTokenFrom(pathname: string): string | undefined {
  const m = /^\/invite\/([A-Za-z0-9_-]{3,64})\/?$/.exec(pathname);
  return m?.[1];
}
