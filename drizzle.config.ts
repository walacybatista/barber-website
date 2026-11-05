import { defineConfig } from 'drizzle-kit';

// .env pode não existir em CI/produção; nesse caso vale o ambiente do processo.
try {
  process.loadEnvFile();
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL não definida. Copie .env.example para .env e ajuste o valor.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
});
