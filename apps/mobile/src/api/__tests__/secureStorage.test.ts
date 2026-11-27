import { secureStorage } from '../secureStorage';

// jest.mock is hoisted above the import.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      if (v.length > 2048) throw new Error('too large');
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store: Map<string, string> = require('expo-secure-store').__store;

describe('secure session storage', () => {
  beforeEach(() => store.clear());

  it('stores a large session in chunks under the keychain size limit and reads it back', async () => {
    const big = 'x'.repeat(5000);
    await secureStorage.setItem('voya.auth', big);
    expect([...store.values()].every((v) => v.length <= 2048)).toBe(true);
    expect(await secureStorage.getItem('voya.auth')).toBe(big);
  });

  it('drops leftover chunks when a value shrinks, and removes everything on sign-out', async () => {
    await secureStorage.setItem('voya.auth', 'y'.repeat(5000));
    await secureStorage.setItem('voya.auth', 'short');
    expect(await secureStorage.getItem('voya.auth')).toBe('short');
    expect(store.size).toBe(2);
    await secureStorage.removeItem('voya.auth');
    expect(store.size).toBe(0);
    expect(await secureStorage.getItem('voya.auth')).toBeNull();
  });

  it('treats a torn write as no session', async () => {
    await secureStorage.setItem('voya.auth', 'z'.repeat(4000));
    store.delete('voya.auth.1');
    expect(await secureStorage.getItem('voya.auth')).toBeNull();
  });
});
