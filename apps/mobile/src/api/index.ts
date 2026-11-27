import * as Linking from 'expo-linking';
import { File } from 'expo-file-system';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import type { LocalAccountBridge } from '@/mocks/localAccount';
import type { RuntimeConfig } from '@/config/runtime';
import type { AuthService, ProfileService, Services } from '@/services/contracts';
import { ServiceError } from '@/services/types';
import { createRealAccountServices } from './account';
import { secureStorage } from './secureStorage';
import { clearStoredSession, createSupabase } from './supabase';

/**
 * Real-mode services: Supabase Auth + Voya API for `auth` and `profile`;
 * every other service is still the mock (B2 onward), acting as the real
 * account through the bridge.
 */
export function createRealServices(config: RuntimeConfig, mocks: Services, bridge: LocalAccountBridge): Services {
  if (config.problems.length > 0 || !config.supabaseUrl || !config.supabaseKey || !config.apiUrl) {
    return { ...mocks, ...unconfigured(config.problems) };
  }
  const supabase = createSupabase(config.supabaseUrl, config.supabaseKey);
  const { auth, profile } = createRealAccountServices({
    supabase,
    apiUrl: config.apiUrl,
    supabaseUrl: config.supabaseUrl,
    bridge,
    kv: secureStorage,
    recoveryRedirect: () => Linking.createURL('/set-password'),
    uploadFile: async (localUri, url, contentType) => {
      if (!new File(localUri).exists) throw new Error('missing file');
      const res = await uploadAsync(url, localUri, {
        httpMethod: 'PUT',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: { 'content-type': contentType },
      });
      return res.status;
    },
    clearStoredSession,
  });
  // Password-reset links (cold start and while running).
  void Linking.getInitialURL().then((url) => (url ? auth.handleUrl(url) : undefined));
  Linking.addEventListener('url', ({ url }) => void auth.handleUrl(url));
  return { ...mocks, auth, profile };
}

/**
 * Real mode asked for but not configured: say so on every attempt instead of
 * quietly using mock accounts.
 */
function unconfigured(problems: string[]): { auth: AuthService; profile: ProfileService } {
  if (__DEV__) console.warn(`Voya real auth is not configured: ${problems.join(', ')} (see apps/mobile/.env.example)`);
  const fail = async (): Promise<never> => {
    throw new ServiceError('unavailable', 'Sign-in is not set up in this build.', false);
  };
  return {
    auth: {
      getSession: async () => null,
      signIn: fail, signUp: fail, verifyEmailCode: fail, resendVerificationCode: fail, abandonSignUp: async () => {},
      requestPasswordReset: fail, setNewPassword: fail, signInWithApple: fail, signInWithGoogle: fail,
      signOut: async () => {}, deleteAccount: fail,
    },
    profile: {
      getAccount: fail, updateProfile: fail, setInterests: fail, completeOnboardingStep: fail, setAvatar: fail,
      getSettings: fail, updateSettings: fail, resetRecommendations: fail,
    },
  };
}
