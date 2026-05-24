import tsParser from '@typescript-eslint/parser';

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
    rules: {
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any',    prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
      ],
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
