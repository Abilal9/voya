import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'supabase/**', 'scripts/**', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Config is read once, in src/config/env.ts (and the seed's safety check).
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Inject ENV instead.' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/config/env.ts', 'src/health/health.service.ts', 'prisma/seed.ts', 'test/**'],
    rules: { 'no-restricted-properties': 'off' },
  },
);
