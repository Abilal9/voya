import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Which implementation backs auth and the profile, and where the real backend
 * is. Read once at startup from EXPO_PUBLIC_* variables (inlined by Expo at
 * build time; see apps/mobile/.env.example).
 *
 * - Development (`__DEV__`): `EXPO_PUBLIC_VOYA_AUTH=supabase` opts in to the
 *   real Supabase + API provider; anything else keeps the mock provider.
 * - Any non-development build is ALWAYS real: the mock provider, its seeded
 *   accounts and the dev account switcher can never ship.
 *
 * Supabase and API URLs default, in development only, to the machine running
 * Metro (from Expo's host URI), so the iOS Simulator, the Android Emulator
 * (10.0.2.2) and a phone on the same Wi-Fi all reach the local stack without
 * anyone writing an IP address into the app. Explicit variables win.
 */
export type AuthProviderKind = 'mock' | 'supabase';

export interface RuntimeConfig {
  authProvider: AuthProviderKind;
  supabaseUrl?: string;
  /** Public (publishable / anon) key only. Never a secret or service-role key. */
  supabaseKey?: string;
  apiUrl?: string;
  /** What is missing for the real provider; it reports these instead of falling back to mocks. */
  problems: string[];
}

const LOCAL_SUPABASE_PORT = 54321;
const LOCAL_API_PORT = 3000;

/** The development machine as this device can reach it, from Metro's host URI. */
export function devHost(hostUri: string | undefined = Constants.expoConfig?.hostUri, os: string = Platform.OS): string {
  const host = hostUri?.split(':')[0]?.trim() || 'localhost';
  const loopback = host === 'localhost' || host === '127.0.0.1';
  // The Android Emulator reaches the host machine at 10.0.2.2, not its own loopback.
  return loopback && os === 'android' ? '10.0.2.2' : host;
}

export function resolveRuntimeConfig(input: {
  dev: boolean;
  env: Record<string, string | undefined>;
  host: string;
}): RuntimeConfig {
  const { dev, env, host } = input;
  const authProvider: AuthProviderKind = !dev || env.EXPO_PUBLIC_VOYA_AUTH === 'supabase' ? 'supabase' : 'mock';
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || (dev ? `http://${host}:${LOCAL_SUPABASE_PORT}` : undefined);
  const apiUrl = env.EXPO_PUBLIC_API_URL || (dev ? `http://${host}:${LOCAL_API_PORT}` : undefined);
  const supabaseKey = env.EXPO_PUBLIC_SUPABASE_KEY || undefined;
  const problems: string[] = [];
  if (authProvider === 'supabase') {
    if (!supabaseUrl) problems.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) problems.push('EXPO_PUBLIC_SUPABASE_KEY');
    if (!apiUrl) problems.push('EXPO_PUBLIC_API_URL');
    if (supabaseKey && /^sb_secret_|service_role/.test(supabaseKey)) problems.push('EXPO_PUBLIC_SUPABASE_KEY must be the public key');
  }
  return { authProvider, supabaseUrl, supabaseKey, apiUrl, problems };
}

export const runtimeConfig: RuntimeConfig = resolveRuntimeConfig({
  dev: __DEV__,
  // Each variable is named in full so Expo inlines it at build time.
  env: {
    EXPO_PUBLIC_VOYA_AUTH: process.env.EXPO_PUBLIC_VOYA_AUTH,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  },
  host: devHost(),
});
