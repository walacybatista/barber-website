// Uso: npm run db:anonymize [-- <dias>]   (padrão 90; RN06). Agende em cron diário.
import { createDb, loadDotEnv, readEnv } from '../src/db/client.ts';
import { anonymizeOldBookings } from '../src/lib/booking/repository.ts';

loadDotEnv();
const url = readEnv('DATABASE_URL');
if (!url) throw new Error('DATABASE_URL não definida.');
const days = process.argv[2] ? Number(process.argv[2]) : 90;
if (!Number.isInteger(days) || days < 1) throw new Error('Dias inválido.');

const { db, sql } = createDb(url, { max: 1 });
try {
  const n = await anonymizeOldBookings(db, { days });
  console.log(`anonimizados: ${n} agendamento(s) com mais de ${days} dias`);
} finally {
  await sql.end();
}
