import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage in the platform keychain / keystore.
 *
 * SecureStore values should stay under ~2 KB, and a Supabase session (two
 * tokens plus the user) can be larger, so values are split into chunks under
 * `<key>.0`, `<key>.1`, … with the chunk count in `<key>`. Nothing here
 * touches AsyncStorage: tokens never sit in plain app storage.
 */
const CHUNK = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** SecureStore keys allow only [A-Za-z0-9._-]. */
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const count = Number(await SecureStore.getItemAsync(k, OPTIONS));
    if (!Number.isInteger(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, OPTIONS);
      if (part === null) return null; // torn write: treat as no session
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key);
    const previous = Number(await SecureStore.getItemAsync(k, OPTIONS)) || 0;
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), OPTIONS);
    }
    await SecureStore.setItemAsync(k, String(count), OPTIONS);
    for (let i = count; i < previous; i += 1) await SecureStore.deleteItemAsync(`${k}.${i}`, OPTIONS);
  },

  async removeItem(key: string): Promise<void> {
    const k = safe(key);
    const count = Number(await SecureStore.getItemAsync(k, OPTIONS)) || 0;
    await SecureStore.deleteItemAsync(k, OPTIONS);
    for (let i = 0; i < count; i += 1) await SecureStore.deleteItemAsync(`${k}.${i}`, OPTIONS);
  },
};
