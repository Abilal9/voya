// Ensures the local-only ES256 key Supabase Auth signs access tokens with
// (supabase/config.toml → auth.signing_keys_path). Idempotent. The file holds
// a PRIVATE key and is gitignored; hosted Supabase projects manage their own.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const keysPath = join(apiDir, 'supabase', 'signing_keys.json');

const hasKey = () => {
  try {
    const keys = JSON.parse(readFileSync(keysPath, 'utf8'));
    return Array.isArray(keys) && keys.length > 0;
  } catch {
    return false;
  }
};

if (existsSync(keysPath) && hasKey()) {
  console.log('supabase/signing_keys.json present');
} else {
  writeFileSync(keysPath, '[]\n', { mode: 0o600 });
  execFileSync('supabase', ['gen', 'signing-key', '--algorithm', 'ES256', '--append'], {
    cwd: apiDir,
    stdio: 'inherit',
  });
  if (!hasKey()) throw new Error('supabase gen signing-key did not write a key');
}
