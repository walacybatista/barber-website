import { randomBytes, scryptSync } from 'node:crypto';
import { eq, sql as dsql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  adminUsers,
  barbers,
  bookings,
  loginAttempts,
  services,
  timeBlocks,
} from '../../src/db/schema.ts';
import { login } from '../../src/lib/auth/login.ts';
import { verifyPassword } from '../../src/lib/auth/password.ts';
import { consumeRateLimit } from '../../src/lib/rate-limit.ts';
import { BlockConflictError, SlotTakenError } from '../../src/lib/booking/errors.ts';
import {
  anonymizeOldBookings,
  createBooking,
  createTimeBlock,
  listAvailability,
  markBookingStatus,
  rescheduleBooking,
} from '../../src/lib/booking/repository.ts';
import { localToUtc } from '../../src/lib/time/tz.ts';
import { createTestDb, resetDb, seedBasics } from './helpers.ts';

const { db, sql } = createTestDb();
const NOW = new Date('2026-11-05T12:00:00Z');
const DAY = '2026-11-09';
const at = (time: string, date = DAY) => localToUtc(date, time);
let ctx: Awaited<ReturnType<typeof seedBasics>>;

const book = (over: Partial<Parameters<typeof createBooking>[1]> & { time?: string } = {}) =>
  createBooking(db, {
    serviceId: ctx.svc.id,
    barberId: ctx.b1.id,
    startAt: at(over.time ?? '10:00'),
    customerName: 'Fulano de Tal',
    customerPhone: '(11) 91234-5678',
    consent: true,
    now: NOW,
    ...over,
  });

beforeAll(async () => {
  await resetDb(db);
});
beforeEach(async () => {
  await resetDb(db);
  ctx = await seedBasics(db);
});
afterAll(async () => {
  await resetDb(db);
  await sql.end();
});

describe('constraints do banco', () => {
  it('opening_hours_step rejeita horário fora de múltiplo de 15 min', async () => {
    await expect(
      db.execute(
        dsql`INSERT INTO opening_hours (weekday, open_time, close_time) VALUES (1, '09:10', '18:00')`,
      ),
    ).rejects.toMatchObject({ cause: { constraint_name: 'opening_hours_step' } });
  });

  it('busy_periods_period_valid rejeita período vazio e ilimitado', async () => {
    const [blk] = await db
      .insert(timeBlocks)
      .values({ barberId: ctx.b1.id, startAt: at('12:00'), endAt: at('13:00') })
      .returning();
    for (const range of ["'empty'::tstzrange", "tstzrange(now(), NULL, '[)')"]) {
      await expect(
        db.execute(
          dsql`INSERT INTO busy_periods (barber_id, block_id, period) VALUES (${ctx.b1.id}, ${blk.id}, ${dsql.raw(range)})`,
        ),
      ).rejects.toMatchObject({ cause: { constraint_name: 'busy_periods_period_valid' } });
    }
  });
});

describe('rate limit: limpeza oportunista', () => {
  const OLD = new Date(NOW.getTime() - 2 * 3600_000);
  const buckets = [{ key: 'booking:t', max: 100, windowMs: 60_000 }];
  const count = async () => (await db.select().from(loginAttempts)).length;

  it('só limpa quando o sorteio cai; falha na limpeza não derruba', async () => {
    await db.insert(loginAttempts).values({ key: 'x', attemptedAt: OLD });
    await consumeRateLimit(db, buckets, NOW, () => 0.99);
    expect(await count()).toBe(2);
    await consumeRateLimit(db, buckets, NOW, () => 0);
    expect(await count()).toBe(2); // velho removido; 2 novos ficam
    await db.insert(loginAttempts).values({ key: 'x', attemptedAt: OLD });
    const broken = new Proxy(db, {
      get: (t, p, r) =>
        p === 'delete'
          ? () => {
              throw new Error('boom');
            }
          : Reflect.get(t, p, r),
    });
    await expect(consumeRateLimit(broken, buckets, NOW, () => 0)).resolves.toHaveLength(1);
  });
});

describe('login: rehash transparente', () => {
  it('hash com N menor é regravado com os parâmetros atuais', async () => {
    const salt = randomBytes(16);
    const key = scryptSync('senha-de-teste-123', salt, 64, { N: 2 ** 14, r: 8, p: 1 });
    const old = ['scrypt', 2 ** 14, 8, 1, salt.toString('base64'), key.toString('base64')].join(
      '$',
    );
    await db.insert(adminUsers).values({ username: 'dono', passwordHash: old });
    await login(db, { username: 'dono', password: 'senha-de-teste-123', ip: '1.1.1.1', now: NOW });
    const [u] = await db.select().from(adminUsers).where(eq(adminUsers.username, 'dono'));
    expect(u.passwordHash).not.toBe(old);
    expect(u.passwordHash.split('$')[1]).toBe(String(2 ** 17));
    expect(await verifyPassword('senha-de-teste-123', u.passwordHash)).toBe(true);
  });
});

describe('repository: robustez', () => {
  it('sem preferência com todos inativos: SlotTakenError; barbeiro específico inativo: NOT_FOUND', async () => {
    await db.update(barbers).set({ active: false });
    await expect(book({ barberId: null })).rejects.toBeInstanceOf(SlotTakenError);
    await expect(book({ barberId: ctx.b1.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('listAvailability: data inválida rejeitada; fora da janela devolve vazio', async () => {
    const q = (date: string) =>
      listAvailability(db, { date, serviceId: ctx.svc.id, barberId: null, now: NOW });
    await expect(q('2026-02-31')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(q('lixo')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(await q('2026-11-01')).toEqual([]);
    expect(await q('2027-03-01')).toEqual([]);
    expect((await q(DAY)).length).toBeGreaterThan(0);
  });

  it('reagendar usa a duração original mesmo com serviço desativado/alterado', async () => {
    const { token, booking } = await book({ time: '10:00' }); // 30 min
    await db
      .update(services)
      .set({ active: false, durationMin: 90 })
      .where(eq(services.id, ctx.svc.id));
    const r = await rescheduleBooking(db, token, at('15:00'), { now: NOW });
    expect(r.endAt.getTime() - r.startAt.getTime()).toBe(30 * 60_000);
    expect(r.id).toBe(booking.id);
  });

  it('completed/no_show recusados para atendimento futuro; ok depois do início', async () => {
    const { booking } = await book();
    for (const s of ['completed', 'no_show'] as const) {
      await expect(markBookingStatus(db, booking.id, s, NOW)).rejects.toMatchObject({
        code: 'INVALID_STATE',
      });
    }
    await markBookingStatus(db, booking.id, 'completed', at('10:30'));
    const b2 = await book({ time: '12:00', customerPhone: '(11) 92222-3333' });
    await expect(markBookingStatus(db, b2.booking.id, 'cancelled', NOW)).resolves.toBeDefined();
  });

  it('bloqueio sobre agendamento: BlockConflictError com mensagem para o admin', async () => {
    await book({ time: '10:00' });
    const err = await createTimeBlock(db, {
      barberId: ctx.b1.id,
      startAt: at('10:00'),
      endAt: at('11:00'),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BlockConflictError);
    expect((err as Error).message).toMatch(/Cancele o agendamento/);
  });

  it('sem preferência escolhe o barbeiro com menos confirmados no dia; empate pelo menor id', async () => {
    await book({ barberId: ctx.b1.id, time: '09:00' });
    await book({ barberId: ctx.b1.id, time: '09:30', customerPhone: '(11) 92222-3333' });
    const r1 = await book({ barberId: null, time: '14:00', customerPhone: '(11) 93333-4444' });
    expect(r1.booking.barberId).toBe(ctx.b2.id); // b1: 2, b2: 0
    const r2 = await book({ barberId: null, time: '15:00', customerPhone: '(11) 94444-5555' });
    expect(r2.booking.barberId).toBe(ctx.b2.id); // b1: 2, b2: 1
    const r3 = await book({ barberId: null, time: '16:00', customerPhone: '(11) 95555-6666' });
    expect(r3.booking.barberId).toBe(ctx.b1.id); // 2 x 2: menor id
  });
});

describe('anonimização (LGPD)', () => {
  it('cancelado é anonimizado 30 dias após cancelledAt; motivo de bloqueio antigo é limpo', async () => {
    const c = await book({ time: '10:00' });
    await markBookingStatus(db, c.booking.id, 'cancelled', NOW);
    const keep = await book({ time: '11:00', customerPhone: '(11) 92222-3333' });
    const blk = await createTimeBlock(db, {
      barberId: ctx.b1.id,
      startAt: at('13:00'),
      endAt: at('14:00'),
      reason: 'consulta médica',
    });
    const d29 = new Date(NOW.getTime() + 29 * 86400_000);
    expect(await anonymizeOldBookings(db, { now: d29 })).toBe(0);
    const d31 = new Date(NOW.getTime() + 31 * 86400_000);
    expect(await anonymizeOldBookings(db, { now: d31 })).toBe(1);
    const [row] = await db.select().from(bookings).where(eq(bookings.id, c.booking.id));
    expect(row.customerName).toBe('Anonimizado');
    const [k] = await db.select().from(bookings).where(eq(bookings.id, keep.booking.id));
    expect(k.anonymizedAt).toBeNull();
    // bloqueio só é limpo após 90 dias do fim
    const [b0] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, blk.id));
    expect(b0.reason).toBe('consulta médica');
    const d91 = new Date(at('14:00').getTime() + 91 * 86400_000);
    await anonymizeOldBookings(db, { now: d91 });
    const [b1] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, blk.id));
    expect(b1.reason).toBe('');
  });
});

describe('seed', () => {
  it('reativa itens presentes em business.ts que foram desativados', async () => {
    const { spawnSync } = await import('node:child_process');
    const run = () =>
      spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/seed.ts'], {
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        encoding: 'utf8',
      });
    await resetDb(db);
    expect(run().status).toBe(0);
    await db.update(services).set({ active: false });
    await db.update(barbers).set({ active: false });
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const s = await db.select().from(services);
    const b = await db.select().from(barbers);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.active)).toBe(true);
    expect(b.every((x) => x.active)).toBe(true);
  }, 30_000);
});
