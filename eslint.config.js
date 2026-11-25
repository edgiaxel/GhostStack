import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const banned = (names, message) => ({
  'no-restricted-imports': ['error', { patterns: names.map((group) => ({ group: [group], message })) }],
});

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'node_modules/**',
      'docs/**',
      '.worktrees/**',
      'apps/web/public/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { 'no-eval': 'error', 'no-new-func': 'error', 'no-implied-eval': 'error' } },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...banned(['idb', '@ghoststack/storage/*'], 'Use useServices(); only app/services.tsx wires storage.'),
    },
  },
  {
    files: ['apps/web/src/app/services.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: [
      'packages/domain/**/*.ts',
      'packages/shared-contracts/**/*.ts',
      'packages/project-format/**/*.ts',
      'packages/behavior/**/*.ts',
    ],
    rules: banned(
      ['react', 'react-dom', 'react/*', 'idb', 'vite', '@ghoststack/storage', '@ghoststack/web'],
      'Domain-side packages must stay free of UI, browser storage and bundler imports.',
    ),
  },
  {
    files: ['packages/player/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: banned(
      ['react', 'react-dom', 'react/*', 'idb', '@ghoststack/storage', '@ghoststack/web'],
      'The player runs outside the editor: no React or storage imports.',
    ),
  },
  { files: ['**/*.config.{js,ts}'], languageOptions: { globals: globals.node } },
);
