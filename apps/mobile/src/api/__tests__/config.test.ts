import { devHost, resolveRuntimeConfig } from '@/config/runtime';

describe('provider selection', () => {
  const KEY = 'sb_publishable_example';

  it('keeps the mock provider in development unless real auth is asked for', () => {
    expect(resolveRuntimeConfig({ dev: true, env: {}, host: 'localhost' }).authProvider).toBe('mock');
    expect(resolveRuntimeConfig({ dev: true, env: { EXPO_PUBLIC_VOYA_AUTH: 'mock' }, host: 'localhost' }).authProvider).toBe('mock');
  });

  it('uses real Supabase auth when asked, pointing at the development machine', () => {
    const c = resolveRuntimeConfig({ dev: true, env: { EXPO_PUBLIC_VOYA_AUTH: 'supabase', EXPO_PUBLIC_SUPABASE_KEY: KEY }, host: '192.168.1.20' });
    expect(c).toEqual({
      authProvider: 'supabase', supabaseUrl: 'http://192.168.1.20:54321', supabaseKey: KEY,
      apiUrl: 'http://192.168.1.20:3000', problems: [],
    });
  });

  it('never lets a non-development build use the mock provider or guess local URLs', () => {
    const c = resolveRuntimeConfig({ dev: false, env: { EXPO_PUBLIC_VOYA_AUTH: 'mock' }, host: 'localhost' });
    expect(c.authProvider).toBe('supabase');
    expect(c.supabaseUrl).toBeUndefined();
    expect(c.problems).toEqual(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY', 'EXPO_PUBLIC_API_URL']);
  });

  it('refuses a secret key in the app', () => {
    const c = resolveRuntimeConfig({
      dev: true, env: { EXPO_PUBLIC_VOYA_AUTH: 'supabase', EXPO_PUBLIC_SUPABASE_KEY: 'sb_secret_abc' }, host: 'localhost',
    });
    expect(c.problems).toContain('EXPO_PUBLIC_SUPABASE_KEY must be the public key');
  });

  it('lets explicit URLs win (staging)', () => {
    const c = resolveRuntimeConfig({
      dev: false,
      env: { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_KEY: KEY, EXPO_PUBLIC_API_URL: 'https://api.staging.test' },
      host: 'localhost',
    });
    expect(c).toMatchObject({ supabaseUrl: 'https://x.supabase.co', apiUrl: 'https://api.staging.test', problems: [] });
  });
});

describe('release builds', () => {
  const KEY = 'sb_publishable_example';
  const release = (env: Record<string, string>) =>
    resolveRuntimeConfig({ dev: false, env: { EXPO_PUBLIC_SUPABASE_KEY: KEY, ...env }, host: 'localhost' }).problems;

  it('refuse the local stack, LAN addresses and plain http', () => {
    expect(release({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EXPO_PUBLIC_API_URL: 'http://192.168.1.20:3000' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL must be a hosted https URL',
      'EXPO_PUBLIC_API_URL must be a hosted https URL',
    ]);
    expect(release({ EXPO_PUBLIC_SUPABASE_URL: 'https://10.0.2.2', EXPO_PUBLIC_API_URL: 'https://voya-mac.local' })).toHaveLength(2);
    expect(release({ EXPO_PUBLIC_SUPABASE_URL: 'http://x.supabase.co', EXPO_PUBLIC_API_URL: 'https://api.staging.test' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL must be a hosted https URL',
    ]);
  });

  it('accept hosted https services', () => {
    expect(release({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_API_URL: 'https://voya-api-staging.up.railway.app/' })).toEqual([]);
  });

  it('leave development builds free to use the Mac', () => {
    const c = resolveRuntimeConfig({ dev: true, env: { EXPO_PUBLIC_VOYA_AUTH: 'supabase', EXPO_PUBLIC_SUPABASE_KEY: KEY }, host: '192.168.1.20' });
    expect(c.problems).toEqual([]);
  });
});

describe('devHost', () => {
  it('uses the Metro host so a phone on Wi-Fi reaches the Mac', () => {
    expect(devHost('192.168.1.20:8081', 'ios')).toBe('192.168.1.20');
  });
  it('maps loopback to 10.0.2.2 on the Android Emulator only', () => {
    expect(devHost('127.0.0.1:8081', 'android')).toBe('10.0.2.2');
    expect(devHost('localhost:8081', 'ios')).toBe('localhost');
    expect(devHost(undefined, 'ios')).toBe('localhost');
  });
});
