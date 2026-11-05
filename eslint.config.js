import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

// @eslint/js (js.configs.recommended) não está instalado; adicioná-lo exige aprovação.
export default defineConfig(
  {
    ignores: [
      'dist',
      '.astro',
      'node_modules',
      'drizzle',
      'coverage',
      'playwright-report',
      'test-results',
    ],
  },
  tseslint.configs.recommended,
  astro.configs.recommended,
);
