import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { assertTestDatabaseUrl } from './helpers.ts';

/** Migra o banco de teste (e só ele) antes da suíte de integração. */
export default async function setup() {
  loadDotEnv();
  const url = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  const { db, sql } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
  } finally {
    await sql.end();
  }
}
