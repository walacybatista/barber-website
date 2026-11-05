import { sql as dsql } from 'drizzle-orm';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { barbers, openingHours, services } from '../../src/db/schema.ts';

/**
 * Recusa qualquer URL cujo banco não termine em `_test` ou `_e2e` (protege o banco de dev).
 * `varName` só melhora a mensagem de erro.
 */
export function assertTestDatabaseUrl(
  url: string | undefined,
  varName = 'TEST_DATABASE_URL',
): string {
  if (!url) throw new Error(`${varName} não definida (ver .env.example).`);
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/_(test|e2e)$/.test(dbName)) {
    throw new Error(
      `Recusado: o banco de teste deve terminar em "_test" ou "_e2e" (recebido: "${dbName}").`,
    );
  }
  return url;
}

export function createTestDb() {
  loadDotEnv();
  return createDb(assertTestDatabaseUrl(process.env.TEST_DATABASE_URL), { max: 12 });
}

export type TestDb = ReturnType<typeof createTestDb>['db'];

export async function resetDb(db: TestDb) {
  await db.execute(
    dsql`TRUNCATE busy_periods, time_blocks, bookings, sessions, login_attempts, admin_users, opening_hours, services, barbers RESTART IDENTITY CASCADE`,
  );
}

/** 1 serviço de 30 min, 2 barbeiros, aberto todos os dias 09:00-18:00. */
export async function seedBasics(db: TestDb) {
  const [svc] = await db
    .insert(services)
    .values({ slug: 'corte', name: 'Corte', durationMin: 30, priceCents: 5000 })
    .returning();
  const [svc60] = await db
    .insert(services)
    .values({ slug: 'combo', name: 'Combo', durationMin: 60, priceCents: 9000 })
    .returning();
  const [b1, b2] = await db
    .insert(barbers)
    .values([
      { slug: 'a', name: 'Barbeiro A' },
      { slug: 'b', name: 'Barbeiro B' },
    ])
    .returning();
  await db
    .insert(openingHours)
    .values(
      [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, openTime: '09:00', closeTime: '18:00' })),
    );
  return { svc, svc60, b1, b2 };
}
