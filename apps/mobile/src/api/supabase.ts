import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import { secureStorage } from './secureStorage';

/** Fixed so sign-out can always clear it, even when the server cannot be reached. */
export const AUTH_STORAGE_KEY = 'voya.auth';

/**
 * The app's one Supabase client, used for Auth only (sign-up, sign-in,
 * verification, recovery, token refresh). Profile data goes through the Voya
 * API, never Supabase's Data API. Holds the PUBLIC key only.
 *
 * Sessions persist in SecureStore and refresh automatically while the app is
 * in the foreground (paused in the background, as Supabase recommends for
 * React Native). PKCE: a password-reset link only works on the phone that
 * asked for it.
 */
export function createSupabase(url: string, publicKey: string): SupabaseClient {
  const client = createClient(url, publicKey, {
    auth: {
      storage: secureStorage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  });
  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') void client.auth.startAutoRefresh();
    else void client.auth.stopAutoRefresh();
  };
  AppState.addEventListener('change', onAppState);
  onAppState(AppState.currentState);
  return client;
}

/** Removes the stored session and PKCE verifier directly (used when the server is unreachable). */
export async function clearStoredSession(): Promise<void> {
  await secureStorage.removeItem(AUTH_STORAGE_KEY);
  await secureStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  await secureStorage.removeItem(`${AUTH_STORAGE_KEY}-user`);
}
