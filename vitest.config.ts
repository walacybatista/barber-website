/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// `npm test` -> projeto unit (sem banco). `npm run test:integration` -> projeto integration
// (banco `barber_test`, migrado no globalSetup; arquivos em série).
export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
