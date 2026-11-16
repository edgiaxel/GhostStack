import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const BROWSER_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'navigator'];

const restrictedGlobals = BROWSER_GLOBALS.map((name) => ({
  name,
  message: `Browser global "${name}" is not allowed in packages. Inject it through a port.`,
}));

const restrictImports = (names) => ({
  'no-restricted-imports': [
    'error',
    { paths: names.map((name) => ({ name, message: `${name} is not allowed in this package.` })) },
  ],
});

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '.kiro/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    files: ['apps/web/pwa/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, GS_BUILD: 'readonly', GS_PRECACHE: 'readonly' },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: { 'no-restricted-globals': ['error', ...restrictedGlobals] },
  },
  {
    files: ['packages/domain/**/*.{ts,tsx}'],
    rules: restrictImports(['react', 'react-dom', 'idb', 'fflate', '@ghoststack/web']),
  },
  {
    files: ['packages/project-format/**/*.{ts,tsx}'],
    rules: restrictImports(['react', 'react-dom', 'idb']),
  },
  {
    files: ['packages/storage/src/port/**/*.{ts,tsx}', 'packages/storage/src/memory/**/*.{ts,tsx}'],
    rules: restrictImports(['react', 'react-dom', 'idb']),
  },
);
