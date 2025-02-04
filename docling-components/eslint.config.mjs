import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import sveltePlugin from 'eslint-plugin-svelte';
import parser from 'svelte-eslint-parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist', 'bin', 'build', 'node_modules'],
  },
  { languageOptions: { globals: globals.browser } },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  ...sveltePlugin.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '*.svelte'],
    languageOptions: {
      parser,
      parserOptions: {
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['**/*.svelte.ts', '*.svelte.ts'],
    languageOptions: {
      parser,
    },
  },
];
