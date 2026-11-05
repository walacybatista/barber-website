import { defineConfig, devices } from '@playwright/test';

// .env pode não existir em CI; só ENOENT é ignorado.
try {
  process.loadEnvFile();
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

// E2E_PORT permite rodar a suíte em outra porta quando a 4322 estiver ocupada.
const PORT = Number(process.env.E2E_PORT) || 4322; // vazio/NaN/0 caem na padrão
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error(
    `E2E_PORT inválida (${process.env.E2E_PORT}): use um inteiro entre 1024 e 65535.`,
  );
}
process.env.E2E_PORT = String(PORT); // repassa aos workers (tests/e2e/helpers.ts)
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Servidor standalone de produção (adaptador Node), não `astro preview`: testa o artefato real
    // e não esbarra no limite de uma instância de preview por projeto.
    command: 'npm run build && node dist/server/entry.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      SITE_URL: baseURL,
      HOST: 'localhost',
      PORT: String(PORT),
    },
  },
});
