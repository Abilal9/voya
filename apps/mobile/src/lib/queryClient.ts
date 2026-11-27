import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one query cache. It holds account data, so the session store
 * clears it whenever the signed-in account changes or signs out — one
 * person's cached plans, settings or profile never show for another.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
