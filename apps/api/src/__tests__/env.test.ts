import { loadEnv } from '../config/env';

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
};

describe('loadEnv', () => {
  it('applies safe defaults and derives the Supabase JWT settings', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.SUPABASE_JWT_ISSUER).toBe('http://127.0.0.1:54321/auth/v1');
    expect(env.SUPABASE_JWKS_URL).toBe('http://127.0.0.1:54321/auth/v1/.well-known/jwks.json');
    expect(env.SUPABASE_JWT_AUDIENCE).toBe('authenticated');
  });

  it('parses CORS origins as a list', () => {
    expect(loadEnv({ ...base, CORS_ORIGINS: 'https://admin.voya.events, http://localhost:3001' }).CORS_ORIGINS).toEqual([
      'https://admin.voya.events',
      'http://localhost:3001',
    ]);
  });

  it('names invalid variables without echoing their values', () => {
    const secret = 'mysql://root:hunter2@db/x';
    expect(() => loadEnv({ ...base, DATABASE_URL: secret, PORT: 'abc' })).toThrow(/PORT[\s\S]*DATABASE_URL: Must be a postgres URL/);
    try {
      loadEnv({ ...base, DATABASE_URL: secret });
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });

  it('requires the database and Supabase URLs', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*SUPABASE_URL/);
  });

  it('enforces production safety', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(() => loadEnv(prod)).toThrow(/SUPABASE_URL: Must be https/);
    expect(() => loadEnv({ ...prod, SUPABASE_URL: 'https://x.supabase.co', CORS_ORIGINS: '*' })).toThrow(/Wildcard/);
    expect(loadEnv({ ...prod, SUPABASE_URL: 'https://x.supabase.co' }).NODE_ENV).toBe('production');
  });
});
