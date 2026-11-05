import { sql as dsql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { barbers, bookings, busyPeriods } from '../../src/db/schema.ts';
import {
  BlockConflictError,
  InvalidSlotError,
  SlotTakenError,
  TooLateError,
  TooManyBookingsError,
} from '../../src/lib/booking/errors.ts';
import {
  anonymizeOldBookings,
  cancelBooking,
  createBooking,
  createTimeBlock,
  deleteTimeBlock,
  getBookingByToken,
  listAgenda,
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
  await resetDb(db); // não deixa linhas em barber_test após a suíte
  await sql.end();
});

describe('RN01 conflito no banco (ADR-006)', () => {
  it('10 criações simultâneas sobrepostas: exatamente 1 sucesso, 9 SlotTakenError', async () => {
    // Inícios diferentes, todos sobrepostos entre si (serviço de 60 min): 10:00, 10:15, 10:30, 10:45.
    const times = [
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '10:00',
      '10:30',
    ];
    const results = await Promise.allSettled(
      times.map((time) => book({ serviceId: ctx.svc60.id, time })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const r of rejected)
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(SlotTakenError);
    const rows = await db.select().from(busyPeriods);
    expect(rows).toHaveLength(1);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  it('mesmo horário, barbeiros diferentes: ambos ok', async () => {
    const [a, b] = await Promise.all([
      book({ barberId: ctx.b1.id }),
      book({ barberId: ctx.b2.id }),
    ]);
    expect(a.booking.barberId).not.toBe(b.booking.barberId);
  });

  it('períodos adjacentes [10:00,10:30) e [10:30,11:00): ambos ok', async () => {
    await book({ time: '10:00' });
    await expect(book({ time: '10:30' })).resolves.toBeDefined();
    await expect(book({ time: '10:15' })).rejects.toBeInstanceOf(SlotTakenError);
  });

  it('agendamento sobre bloqueio: conflito; bloqueio sobre agendamento: conflito', async () => {
    await createTimeBlock(db, {
      barberId: ctx.b1.id,
      startAt: at('12:00'),
      endAt: at('13:00'),
      reason: 'almoço',
    });
    await expect(book({ time: '12:30' })).rejects.toBeInstanceOf(SlotTakenError);
    await expect(book({ time: '13:00' })).resolves.toBeDefined();
    await expect(
      createTimeBlock(db, { barberId: ctx.b1.id, startAt: at('13:15'), endAt: at('14:00') }),
    ).rejects.toBeInstanceOf(BlockConflictError);
  });

  it('remover bloqueio libera o horário', async () => {
    const blk = await createTimeBlock(db, {
      barberId: ctx.b1.id,
      startAt: at('12:00'),
      endAt: at('13:00'),
    });
    await deleteTimeBlock(db, blk.id);
    await expect(book({ time: '12:00' })).resolves.toBeDefined();
  });

  it('sem preferência: cai para o outro barbeiro quando o primeiro está ocupado', async () => {
    await book({ barberId: ctx.b1.id });
    const r = await book({ barberId: null });
    expect(r.booking.barberId).toBe(ctx.b2.id);
    await expect(book({ barberId: null })).rejects.toBeInstanceOf(SlotTakenError);
  });
});

describe('regras de entrada', () => {
  it('rejeita fora do expediente, desalinhado, passado e dado inválido', async () => {
    await expect(book({ time: '08:45' })).rejects.toBeInstanceOf(InvalidSlotError);
    await expect(book({ time: '10:10' })).rejects.toBeInstanceOf(InvalidSlotError);
    await expect(book({ startAt: new Date('2026-11-01T13:00:00Z') })).rejects.toBeInstanceOf(
      InvalidSlotError,
    );
    await expect(book({ customerName: 'A' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(book({ customerPhone: '123' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(book({ consent: false })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('cancelar, reagendar e token', () => {
  it('cancelar libera o horário (e o booking fica como cancelled)', async () => {
    const { token } = await book();
    await expect(book({ barberId: ctx.b1.id })).rejects.toBeInstanceOf(SlotTakenError);
    const c = await cancelBooking(db, token, NOW);
    expect(c.status).toBe('cancelled');
    await expect(book()).resolves.toBeDefined();
    const view = await getBookingByToken(db, token, NOW);
    expect(view?.status).toBe('cancelled');
  });

  it('RN04: cancelar/reagendar com menos de 2h é recusado', async () => {
    const { token } = await book();
    const start = at('10:00');
    const late = new Date(start.getTime() - 119 * 60_000);
    await expect(cancelBooking(db, token, late)).rejects.toBeInstanceOf(TooLateError);
    await expect(rescheduleBooking(db, token, at('11:00'), { now: late })).rejects.toBeInstanceOf(
      TooLateError,
    );
    const ok = new Date(start.getTime() - 120 * 60_000);
    await expect(cancelBooking(db, token, ok)).resolves.toBeDefined();
  });

  it('reagendar com sucesso move o período', async () => {
    const { token } = await book({ time: '10:00' });
    const r = await rescheduleBooking(db, token, at('15:00'), { now: NOW });
    expect(r.startAt.toISOString()).toBe(at('15:00').toISOString());
    await expect(book({ time: '10:00' })).resolves.toBeDefined(); // antigo liberado
    await expect(book({ time: '15:00' })).rejects.toBeInstanceOf(SlotTakenError);
    // reagendar para sobrepor o próprio horário atual também funciona
    await expect(rescheduleBooking(db, token, at('15:15'), { now: NOW })).resolves.toBeDefined();
  });

  it('reagendar com conflito não altera nada', async () => {
    const mine = await book({ time: '10:00' });
    await book({ time: '14:00' });
    await expect(
      rescheduleBooking(db, mine.token, at('14:15'), { now: NOW }),
    ).rejects.toBeInstanceOf(SlotTakenError);
    const view = await getBookingByToken(db, mine.token, NOW);
    expect(view?.startAt.toISOString()).toBe(at('10:00').toISOString());
    // o período antigo continua ocupado
    await expect(book({ time: '10:00' })).rejects.toBeInstanceOf(SlotTakenError);
    const rows = await db.select().from(busyPeriods);
    expect(rows).toHaveLength(2);
  });

  it('token só funciona com o valor original; banco não guarda o token em claro', async () => {
    const { token } = await book();
    expect(await getBookingByToken(db, token, NOW)).not.toBeNull();
    expect(
      await getBookingByToken(db, token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), NOW),
    ).toBeNull();
    expect(await getBookingByToken(db, 'x'.repeat(43), NOW)).toBeNull();
    const dump = await db.execute(dsql`SELECT row_to_json(b)::text AS j FROM bookings b`);
    expect(JSON.stringify([...dump])).not.toContain(token);
    const [row] = await db.select().from(bookings);
    expect(row.manageTokenHash).toMatch(/^[0-9a-f]{64}$/);
    // visão pública: só primeiro nome, sem telefone
    const view = await getBookingByToken(db, token, NOW);
    expect(view?.customerFirstName).toBe('Fulano');
    expect(JSON.stringify(view)).not.toContain('91234');
  });
});

describe('disponibilidade, agenda e status', () => {
  it('listAvailability reflete ocupação e une barbeiros', async () => {
    await book({ barberId: ctx.b1.id, time: '10:00' });
    const slots = await listAvailability(db, {
      date: DAY,
      serviceId: ctx.svc.id,
      barberId: null,
      now: NOW,
    });
    const at10 = slots.find((s) => s.start.getTime() === at('10:00').getTime());
    expect(at10?.barberIds).toEqual([ctx.b2.id]);
    const only1 = await listAvailability(db, {
      date: DAY,
      serviceId: ctx.svc.id,
      barberId: ctx.b1.id,
      now: NOW,
    });
    expect(only1.some((s) => s.start.getTime() === at('10:00').getTime())).toBe(false);
    expect(only1.some((s) => s.start.getTime() === at('09:30').getTime())).toBe(true);
    expect(only1[0].start.toISOString()).toBe(at('09:00').toISOString());
  });

  it('markBookingStatus e listAgenda', async () => {
    const { booking } = await book();
    const rows = await listAgenda(db, { barberId: ctx.b1.id, from: at('00:00'), to: at('23:59') });
    expect(rows.bookings).toHaveLength(1);
    expect(rows.bookings[0].customerPhone).toBe('11912345678');
    await markBookingStatus(db, booking.id, 'no_show', at('12:00'));
    await expect(markBookingStatus(db, booking.id, 'cancelled')).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    await expect(markBookingStatus(db, 99999, 'completed')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('admin cancelar libera horário', async () => {
    const { booking } = await book();
    await markBookingStatus(db, booking.id, 'cancelled', NOW);
    await expect(book()).resolves.toBeDefined();
  });
});

describe('RN06 anonimização', () => {
  it('anonimiza só o que terminou há mais de 90 dias e invalida o token', async () => {
    const old = await book({ time: '10:00' });
    const recent = await book({ time: '11:00' });
    const later = new Date(at('10:00').getTime() + 91 * 24 * 3600_000);
    // `recent` termina no mesmo dia; ajusta para dentro dos 90 dias
    await db.execute(
      dsql`UPDATE bookings SET start_at = start_at + interval '60 days', end_at = end_at + interval '60 days' WHERE id = ${recent.booking.id}`,
    );
    const n = await anonymizeOldBookings(db, { days: 90, now: later });
    expect(n).toBe(1);
    expect(await getBookingByToken(db, old.token, NOW)).toBeNull();
    expect(await getBookingByToken(db, recent.token, NOW)).not.toBeNull();
    const [row] = await db
      .select()
      .from(bookings)
      .where(dsql`id = ${old.booking.id}`);
    expect(row.customerName).toBe('Anonimizado');
    expect(row.customerPhone).toBe('');
    expect(row.anonymizedAt).not.toBeNull();
    expect(await anonymizeOldBookings(db, { days: 90, now: later })).toBe(0);
  });
});

describe('limite de agendamentos futuros por telefone', () => {
  const PHONE = '(11) 98888-7777';
  it('4º confirmado futuro é recusado; cancelar libera; outro telefone não é afetado', async () => {
    const made = [];
    for (const time of ['10:00', '11:00', '12:00']) {
      made.push(await book({ time, customerPhone: PHONE }));
    }
    await expect(book({ time: '13:00', customerPhone: PHONE })).rejects.toBeInstanceOf(
      TooManyBookingsError,
    );
    await expect(book({ time: '13:00', customerPhone: '(11) 97777-6666' })).resolves.toBeDefined();
    await cancelBooking(db, made[0].token, NOW);
    await expect(book({ time: '14:00', customerPhone: PHONE })).resolves.toBeDefined();
  });

  it('agendamento passado não conta', async () => {
    await db.insert(bookings).values({
      serviceId: ctx.svc.id,
      barberId: ctx.b1.id,
      customerName: 'Antigo',
      customerPhone: '11988887777',
      startAt: new Date('2026-10-01T13:00:00Z'),
      endAt: new Date('2026-10-01T13:30:00Z'),
      manageTokenHash: 'x1',
      consentAt: NOW,
    });
    for (const time of ['10:00', '11:00', '12:00']) {
      await book({ time, customerPhone: PHONE });
    }
  });

  it('6 criações concorrentes do mesmo telefone: exatamente 3 sucessos', async () => {
    const times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
    const results = await Promise.allSettled(
      times.map((time) => book({ time, customerPhone: PHONE })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(TooManyBookingsError);
    }
  });
});

describe('concorrência: sem preferência e reagendar x criar', () => {
  it('8 criações com barberId null no mesmo slot: sucessos == barbeiros ativos (3)', async () => {
    await db.insert(barbers).values({ slug: 'c', name: 'Barbeiro C' });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        book({ barberId: null, time: '10:00', customerPhone: `1191000000${i}` }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(3);
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(SlotTakenError);
    }
    const ids = ok.map(
      (r) =>
        (r as PromiseFulfilledResult<{ booking: { barberId: number } }>).value.booking.barberId,
    );
    expect(new Set(ids).size).toBe(3);
    expect(await db.select().from(busyPeriods)).toHaveLength(3);
  });

  it('reschedule x create no mesmo destino (5 rodadas): exatamente um vence, estado consistente', async () => {
    for (let i = 0; i < 5; i++) {
      const day = `2026-11-${String(10 + i).padStart(2, '0')}`;
      const mine = await book({
        startAt: at('10:00', day),
        customerPhone: `1195555444${i}`,
      });
      const [rs, cr] = await Promise.allSettled([
        rescheduleBooking(db, mine.token, at('14:00', day), { now: NOW }),
        book({ startAt: at('14:00', day), customerPhone: `1193000000${i}` }),
      ]);
      expect([rs, cr].filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = [rs, cr].find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(loser.reason).toBeInstanceOf(SlotTakenError);
      const view = await getBookingByToken(db, mine.token, NOW);
      const expected = rs.status === 'fulfilled' ? at('14:00', day) : at('10:00', day);
      expect(view?.startAt.toISOString()).toBe(expected.toISOString());
    }
    // 1 busy_period por agendamento, com o mesmo período do agendamento
    const rows = await db.execute(dsql`
      select count(*)::int as n from busy_periods bp
      join bookings b on b.id = bp.booking_id
      where lower(bp.period) = b.start_at and upper(bp.period) = b.end_at`);
    const all = await db.select().from(bookings);
    expect(rows[0].n).toBe(all.length);
    expect(await db.select().from(busyPeriods)).toHaveLength(all.length);
  });
});
