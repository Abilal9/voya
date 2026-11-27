import { loadEnv } from '../config/env';

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
};

const REF = 'abcdefghijklmnopqrst';
const OTHER = 'zyxwvutsrqponmlkjihg';
const hosted = {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  SUPABASE_PROJECT_REF: REF,
  SUPABASE_URL: `https://${REF}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${REF}:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
  DIRECT_URL: `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`,
  SUPABASE_SECRET_KEY: 'sb_secret_placeholder_for_tests',
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
    const prod = { ...hosted, SUPABASE_URL: 'http://127.0.0.1:54321' };
    expect(() => loadEnv(prod)).toThrow(/SUPABASE_URL: Must be https/);
    expect(() => loadEnv({ ...hosted, CORS_ORIGINS: '*' })).toThrow(/Wildcard/);
    expect(() => loadEnv({ ...hosted, SUPABASE_SECRET_KEY: '' })).toThrow(/SUPABASE_SECRET_KEY: Required/);
    expect(loadEnv(hosted).NODE_ENV).toBe('production');
  });

  it('refuses a production build labelled local', () => {
    expect(() => loadEnv({ ...hosted, APP_ENV: 'local' })).toThrow(/APP_ENV: Must be staging or production/);
  });

  it('binds staging to one hosted Supabase project', () => {
    expect(() => loadEnv({ ...hosted, SUPABASE_PROJECT_REF: '' })).toThrow(/SUPABASE_PROJECT_REF: Required/);
    expect(() => loadEnv({ ...hosted, NODE_ENV: 'development' })).toThrow(/NODE_ENV: Must be production/);
    expect(() => loadEnv({ ...hosted, SUPABASE_URL: `https://${OTHER}.supabase.co` })).toThrow(
      /SUPABASE_URL: Must be the project URL/,
    );
    // Staging API pointed at another project's (e.g. production's) database.
    expect(() =>
      loadEnv({ ...hosted, DATABASE_URL: `postgresql://postgres.${OTHER}:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true` }),
    ).toThrow(/DATABASE_URL: Must belong to SUPABASE_PROJECT_REF/);
    expect(() => loadEnv({ ...hosted, DIRECT_URL: `postgresql://postgres:pw@db.${OTHER}.supabase.co:5432/postgres` })).toThrow(
      /DIRECT_URL: Must belong/,
    );
    expect(() => loadEnv({ ...hosted, DIRECT_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' })).toThrow(
      /DIRECT_URL: Must be a hosted database/,
    );
    expect(() => loadEnv({ ...hosted, DIRECT_URL: '' })).toThrow();
    expect(() => loadEnv({ ...hosted, DATABASE_URL: hosted.DATABASE_URL.replace('?pgbouncer=true', '') })).toThrow(
      /needs \?pgbouncer=true/,
    );
  });

  it('does not echo database passwords in hosted errors', () => {
    let message = '';
    try {
      loadEnv({ ...hosted, DATABASE_URL: `postgresql://postgres.${OTHER}:hunter2@pooler.supabase.com:6543/postgres` });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain(OTHER);
  });

  it('treats a blank secret key as unset', () => {
    expect(loadEnv({ ...base, SUPABASE_SECRET_KEY: '' }).SUPABASE_SECRET_KEY).toBeUndefined();
  });

  it('never echoes a bad value, only the variable name', () => {
    const secret = 'short';
    let message = '';
    try {
      loadEnv({ ...base, SUPABASE_SECRET_KEY: secret });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('SUPABASE_SECRET_KEY');
    expect(message).not.toContain(`: ${secret}`);
  });
});
