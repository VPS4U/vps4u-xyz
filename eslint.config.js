import js from '@eslint/js';
import globals from 'globals';

// Lintujemy tylko nowy kod backendowy (lib/, api/) i testy.
// Istniejący frontend (*.jsx kompilowany Babelem w przeglądarce, legacy *.js)
// zostaje poza scope — sformatujemy go osobnym PR-em później.
export default [
  {
    ignores: [
      'node_modules/',
      'coverage/',
      '.vercel/',
      'dist/',
      'docs/',
      // Frontendowe pliki na razie poza lintem (Stage 0a scope):
      '*.jsx',
      '*.html',
      'cookie-banner.js',
      'subpage-glue.js',
      'subpage-i18n.js',
      'config.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['lib/**/*.js', 'api/**/*.js', 'tests/**/*.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // lib/* zawiera zarówno klientów frontowych (browser, używa window)
        // jak i backendowych (Node, używa process). Lintujemy z obydwoma globalami.
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
];
