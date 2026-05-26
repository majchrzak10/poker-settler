// @ts-check
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'supabase/**', 'src/types/database.types.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      // Downgrade all react-hooks rules to warn. The v7 plugin ships
      // React-Compiler-style checks that fire pervasively on legacy
      // patterns in this codebase. Keep them visible for future cleanup,
      // but don't break lint until each is triaged.
      ...Object.fromEntries(
        Object.keys(reactHooks.configs.recommended.rules)
          .filter(k => k.startsWith('react-hooks/'))
          .map(k => [k, 'warn']),
      ),
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: false }],
    },
  },
];
