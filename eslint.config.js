import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },
];
