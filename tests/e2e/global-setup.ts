import { execFileSync } from 'node:child_process';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { eq } from 'drizzle-orm';
import { barbers, services } from '../../src/db/schema.ts';
import { createBooking } from '../../src/lib/booking/repository.ts';
import { createAdminUser } from '../../src/lib/auth/login.ts';
import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USER,
  E2E_AGENDA_CUSTOMER,
  E2E_XSS_CUSTOMER,
} from './admin-fixtures.ts';
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

  // Dados do painel admin (admin.spec.ts): 1 admin e 1 agendamento em data fixa e distante.
  const { db: db2, sql: sql2 } = createDb(url, { max: 1 });
  try {
    await createAdminUser(db2, E2E_ADMIN_USER, E2E_ADMIN_PASSWORD);
    const [service] = await db2.select().from(services).where(eq(services.slug, 'corte-classico'));
    const [rafael] = await db2.select().from(barbers).where(eq(barbers.slug, 'rafael-quintao'));
    const [dandara] = await db2.select().from(barbers).where(eq(barbers.slug, 'dandara-veloso'));
    if (!service || !rafael || !dandara)
      throw new Error('Seed E2E incompleto (serviço/barbeiros).');
    // `now` antigo contorna a janela de agendamento (RN03); endAt vem da duração real do serviço.
    const now = new Date('2031-03-05T12:00:00Z');
    await createBooking(db2, {
      serviceId: service.id,
      barberId: rafael.id,
      startAt: new Date('2031-03-12T13:00:00Z'), // 10:00 em America/Sao_Paulo
      customerName: E2E_AGENDA_CUSTOMER,
      customerPhone: '11955550123',
      consent: true,
      now,
    });
    await createBooking(db2, {
      serviceId: service.id,
      barberId: dandara.id,
      startAt: new Date('2031-03-12T14:00:00Z'), // 11:00 local
      customerName: E2E_XSS_CUSTOMER,
      customerPhone: '11955550124',
      consent: true,
      now,
    });
  } finally {
    await sql2.end();
  }
}
