import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // ─── Structure ─────────────────────────────────────────────
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any',    prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
      ],

      // ─── Correctness ──────────────────────────────────────────
      'eqeqeq':              ['error', 'always', { null: 'ignore' }],
      'no-throw-literal':    'error',
      'no-duplicate-imports': 'error',
      'no-var':              'error',
      'prefer-const':        'error',
      'no-implicit-coercion': 'error',
      'no-useless-concat':   'error',
      'no-useless-rename':   'error',
      'no-return-await':     'error',

      // ─── Cleanliness ──────────────────────────────────────────
      'prefer-template':       'error',
      'object-shorthand':      'error',
      'prefer-arrow-callback': 'error',
      'curly':                 ['error', 'all'],
      'arrow-body-style':      ['error', 'as-needed'],

      // ─── TypeScript ───────────────────────────────────────────
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any':        'warn',
      '@typescript-eslint/no-non-null-assertion':  'warn',
      '@typescript-eslint/no-inferrable-types':    'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      // Tests use mock plumbing (`as unknown as Service`) that's hard to avoid.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.playwright-tmp/**',
      '**/.playwright-mcp/**',
      '**/playwright-report/**',
      '**/coverage/**',
      '**/data/**',
      '**/*.tsbuildinfo',
      'frontend/vite.config.d.ts',
      'frontend/vite.config.js',
      'docs/**',
    ],
  },
];
