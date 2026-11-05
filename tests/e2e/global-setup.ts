import { execFileSync } from 'node:child_process';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { assertTestDatabaseUrl, resetDb } from '../integration/helpers.ts';

/** Migra, esvazia (TRUNCATE) e popula (seed) o banco E2E (`barber_e2e`, e só ele) antes do e2e. */
export default async function setup() {
  loadDotEnv();
  const url = assertTestDatabaseUrl(process.env.E2E_DATABASE_URL, 'E2E_DATABASE_URL');
  const { db, sql } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    await resetDb(db);
  } finally {
    await sql.end();
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/seed.ts'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
