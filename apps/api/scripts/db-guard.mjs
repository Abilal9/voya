// Stops local Prisma commands from touching a hosted database by accident.
//
//   node scripts/db-guard.mjs local    db:migrate, db:reset, db:seed: loopback databases only
//   node scripts/db-guard.mjs deploy   db:deploy: loopback, or a hosted database only when
//                                      VOYA_CONFIRM_REMOTE_MIGRATION names its project ref
//
// It reads DATABASE_URL / DIRECT_URL the way Prisma does (the process
// environment first, then apps/api/.env) and prints host names and project
// refs only, never credentials. Hosted staging is migrated by Railway's
// pre-deploy step, so the deploy override is for a deliberate manual run.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (mode !== 'local' && mode !== 'deploy') {
  console.error('usage: db-guard.mjs local|deploy');
  process.exit(2);
}

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const fileVars = {};
for (const file of [join(apiDir, '.env'), join(apiDir, 'prisma', '.env')]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (match && !(match[1] in fileVars)) fileVars[match[1]] = match[2];
  }
}
const read = (name) => process.env[name] ?? fileVars[name] ?? '';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Host and Supabase project ref of a postgres URL, without its credentials. */
function describe(name, value) {
  try {
    const url = new URL(value);
    const ref = url.username.includes('.')
      ? url.username.split('.').pop()
      : /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1];
    return { name, host: url.hostname, local: LOOPBACK.has(url.hostname), ref };
  } catch {
    return { name, host: '(unparseable)', local: false, ref: undefined };
  }
}

const targets = ['DATABASE_URL', 'DIRECT_URL'].filter((n) => read(n)).map((n) => describe(n, read(n)));
if (targets.length === 0) {
  console.error('db-guard: DATABASE_URL is not set (copy apps/api/.env.example to apps/api/.env).');
  process.exit(1);
}
const remote = targets.filter((t) => !t.local);
if (remote.length === 0) process.exit(0);

const where = remote.map((t) => `${t.name} → ${t.host}${t.ref ? ` (project ${t.ref})` : ''}`).join(', ');
if (mode === 'local') {
  console.error(`db-guard: refusing — this command is for the local stack only, but ${where}.`);
  console.error('Hosted databases are migrated by the Railway pre-deploy step and are never reset or seeded from here.');
  process.exit(1);
}

const refs = [...new Set(remote.map((t) => t.ref))];
const confirmed = process.env.VOYA_CONFIRM_REMOTE_MIGRATION;
if (refs.length !== 1 || !refs[0] || confirmed !== refs[0]) {
  console.error(`db-guard: refusing to migrate a hosted database: ${where}.`);
  console.error('To run `prisma migrate deploy` there on purpose, set VOYA_CONFIRM_REMOTE_MIGRATION=<that project ref>.');
  process.exit(1);
}
console.error(`db-guard: applying migrations to hosted project ${refs[0]} (confirmed).`);
