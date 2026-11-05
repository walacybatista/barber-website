import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Db } from '../../db/client.ts';
import {
  barbers,
  bookings,
  busyPeriods,
  openingHours,
  services,
  timeBlocks,
} from '../../db/schema.ts';
import { DEFAULT_TIMEZONE, isValidLocalDate, localToUtc, utcToLocalDate } from '../time/tz.ts';
import {
  BlockConflictError,
  InvalidInputError,
  InvalidSlotError,
  InvalidStateError,
  NotFoundError,
  SlotTakenError,
  TooLateError,
  TooManyBookingsError,
} from './errors.ts';
import {
  bookingWindow,
  canManage,
  checkBookingStart,
  computeAvailableSlots,
  normalizePhone,
  type BusyPeriod,
  type OpeningHour,
} from './rules.ts';
import { generateToken, hashToken } from './token.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

const MIN = 60_000;

/** Anti-spam: máximo de agendamentos `confirmed` futuros por telefone. */
export const MAX_FUTURE_BOOKINGS_PER_PHONE = 3;

/** `23P01` = exclusion_violation. O Drizzle embrulha o erro do driver em `cause`. */
export function isExclusionViolation(err: unknown): boolean {
  return hasPgCode(err, '23P01');
}

function hasPgCode(err: unknown, code: string): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    if ((cur as { code?: string }).code === code) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Transação que insere em busy_periods. Inserções concorrentes de períodos sobrepostos com início
 * diferente podem se esperar mutuamente: o Postgres aborta uma com `40P01` (deadlock_detected).
 * Repetimos: na nova tentativa o conflito aparece como 23P01 (SlotTaken) ou o horário está livre.
 */
async function transact<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(fn);
    } catch (err) {
      if (attempt < 4 && hasPgCode(err, '40P01')) continue;
      throw err;
    }
  }
}

/**
 * Serializa gravações de um mesmo barbeiro (lock consultivo até o fim da transação). Evita deadlocks
 * entre inserções concorrentes sobrepostas; a EXCLUDE constraint continua sendo a garantia final.
 */
async function lockBarber(tx: Tx, barberId: number): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(7001, ${barberId})`);
}
function rangeSql(start: Date, end: Date) {
  return sql`tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)')`;
}

// ---------- Catálogo ----------

export async function listCatalog(db: Executor) {
  const [svc, brb, hours] = await Promise.all([
    db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.id)),
    db.select().from(barbers).where(eq(barbers.active, true)).orderBy(asc(barbers.id)),
    db.select().from(openingHours).orderBy(asc(openingHours.weekday), asc(openingHours.openTime)),
  ]);
  return { services: svc, barbers: brb, openingHours: toOpeningHours(hours) };
}

function toOpeningHours(rows: (typeof openingHours.$inferSelect)[]): OpeningHour[] {
  // `time` volta como "HH:MM:SS"
  return rows.map((r) => ({
    weekday: r.weekday,
    open: r.openTime.slice(0, 5),
    close: r.closeTime.slice(0, 5),
  }));
}

async function loadHours(db: Executor): Promise<OpeningHour[]> {
  const rows = await db.select().from(openingHours);
  return toOpeningHours(rows);
}

/** Data local seguinte (`YYYY-MM-DD`), por aritmética de calendário. */
function nextLocalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

async function loadService(db: Executor, serviceId: number) {
  const [s] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.active, true)));
  if (!s) throw new NotFoundError('Serviço');
  return s;
}

// ---------- Disponibilidade ----------

export type AvailableSlot = { start: Date; barberIds: number[] };

/** Horários livres de uma data local. Sem `barberId` ("sem preferência"): união dos barbeiros ativos. */
export async function listAvailability(
  db: Executor,
  input: {
    date: string;
    serviceId: number;
    barberId?: number | null;
    now?: Date;
    timezone?: string;
    /** Ignora o busy_period deste agendamento (reagendamento pode sobrepor o próprio horário). */
    ignoreBookingId?: number;
    /** Sobrepõe a duração do serviço (reagendamento usa a original); dispensa serviço ativo. */
    durationMin?: number;
  },
): Promise<AvailableSlot[]> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidLocalDate(input.date)) throw new InvalidInputError('Data inválida.');
  // Fora da janela (RN03) não há horário: evita consultar o banco para datas passadas/remotas.
  const { earliest, latest } = bookingWindow(now);
  const dayStartUtc = localToUtc(input.date, '00:00', timezone);
  const dayEndUtc = localToUtc(nextLocalDate(input.date), '00:00', timezone);
  if (dayEndUtc <= earliest || dayStartUtc > latest) return [];
  const service =
    input.durationMin !== undefined
      ? { durationMin: input.durationMin }
      : await loadService(db, input.serviceId);

  const barberRows = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(
      input.barberId
        ? and(eq(barbers.id, input.barberId), eq(barbers.active, true))
        : eq(barbers.active, true),
    )
    .orderBy(asc(barbers.id));
  if (input.barberId && barberRows.length === 0) throw new NotFoundError('Barbeiro');
  if (barberRows.length === 0) return [];

  const hours = await loadHours(db);
  const dayStart = localToUtc(input.date, '00:00', timezone);
  const dayEnd = new Date(dayStart.getTime() + 26 * 60 * MIN);
  const ids = barberRows.map((b) => b.id);

  const busyRows = await db
    .select({
      barberId: busyPeriods.barberId,
      startMs: sql<string>`(extract(epoch from lower(${busyPeriods.period})) * 1000)::bigint`,
      endMs: sql<string>`(extract(epoch from upper(${busyPeriods.period})) * 1000)::bigint`,
    })
    .from(busyPeriods)
    .where(
      and(
        inArray(busyPeriods.barberId, ids),
        sql`${busyPeriods.period} && ${rangeSql(dayStart, dayEnd)}`,
        input.ignoreBookingId !== undefined
          ? or(isNull(busyPeriods.bookingId), ne(busyPeriods.bookingId, input.ignoreBookingId))
          : undefined,
      ),
    );

  const byStart = new Map<number, number[]>();
  for (const barberId of ids) {
    const busy: BusyPeriod[] = busyRows
      .filter((r) => r.barberId === barberId)
      .map((r) => ({ start: new Date(Number(r.startMs)), end: new Date(Number(r.endMs)) }));
    const slots = computeAvailableSlots({
      date: input.date,
      service,
      busy,
      openingHours: hours,
      now,
      timezone,
    });
    for (const s of slots) {
      const list = byStart.get(s.getTime()) ?? [];
      list.push(barberId);
      byStart.set(s.getTime(), list);
    }
  }
  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, barberIds]) => ({ start: new Date(ms), barberIds }));
}

/**
 * Horários para reagendar pelo token: mesmo barbeiro, duração ORIGINAL (`endAt - startAt`),
 * ignorando o próprio busy_period. Token desconhecido: NotFoundError. Agendamento que não está
 * `confirmed`: lista vazia.
 */
export async function getRescheduleAvailability(
  db: Executor,
  input: { token: string; date: string; now?: Date; timezone?: string },
): Promise<AvailableSlot[]> {
  const [b] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.manageTokenHash, hashToken(input.token)));
  if (!b) throw new NotFoundError('Agendamento');
  if (b.status !== 'confirmed') return [];
  return listAvailability(db, {
    date: input.date,
    serviceId: b.serviceId,
    barberId: b.barberId,
    now: input.now,
    timezone: input.timezone,
    ignoreBookingId: b.id,
    durationMin: Math.round((b.endAt.getTime() - b.startAt.getTime()) / MIN),
  });
}

// ---------- Agendamentos ----------

export type CreateBookingInput = {
  serviceId: number;
  /** `null` = sem preferência: tenta os barbeiros ativos, do menos ao mais carregado no dia. */
  barberId: number | null;
  startAt: Date;
  customerName: string;
  customerPhone: string;
  consent: boolean;
  now?: Date;
  timezone?: string;
};

export type BookingSummary = {
  id: number;
  serviceId: number;
  barberId: number;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
};

async function insertBookingTx(
  db: Db,
  p: {
    serviceId: number;
    barberId: number;
    startAt: Date;
    endAt: Date;
    name: string;
    phone: string;
    now: Date;
  },
): Promise<{ booking: BookingSummary; token: string }> {
  const { token, hash } = generateToken();
  try {
    const booking = await transact(db, async (tx) => {
      // Ordem fixa de locks (telefone, depois barbeiro) evita deadlock; o lock do telefone torna
      // o limite imune a criações concorrentes.
      await tx.execute(sql`select pg_advisory_xact_lock(7003, hashtext(${p.phone}))`);
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.customerPhone, p.phone),
            eq(bookings.status, 'confirmed'),
            gt(bookings.startAt, p.now),
          ),
        );
      if (n >= MAX_FUTURE_BOOKINGS_PER_PHONE) {
        throw new TooManyBookingsError(MAX_FUTURE_BOOKINGS_PER_PHONE);
      }
      await lockBarber(tx, p.barberId);
      const [b] = await tx
        .insert(bookings)
        .values({
          serviceId: p.serviceId,
          barberId: p.barberId,
          customerName: p.name,
          customerPhone: p.phone,
          startAt: p.startAt,
          endAt: p.endAt,
          manageTokenHash: hash,
          consentAt: p.now,
        })
        .returning();
      await tx.insert(busyPeriods).values({
        barberId: p.barberId,
        period: rangeSql(p.startAt, p.endAt) as unknown as string,
        bookingId: b.id,
      });
      return b;
    });
    return { booking, token };
  } catch (err) {
    if (isExclusionViolation(err)) throw new SlotTakenError();
    throw err;
  }
}

export async function createBooking(
  db: Db,
  input: CreateBookingInput,
): Promise<{ booking: BookingSummary; token: string }> {
  const now = input.now ?? new Date();
  const name = input.customerName.trim();
  const phone = normalizePhone(input.customerPhone);
  if (name.length < 2 || name.length > 80) throw new InvalidInputError('Nome inválido.');
  if (!phone) throw new InvalidInputError('Telefone inválido.');
  if (input.consent !== true) throw new InvalidInputError('Consentimento é obrigatório.');

  const service = await loadService(db, input.serviceId);
  const hours = await loadHours(db);
  const check = checkBookingStart({
    start: input.startAt,
    durationMin: service.durationMin,
    openingHours: hours,
    now,
    timezone: input.timezone,
  });
  if (check !== 'ok') throw new InvalidSlotError(check);

  let candidates = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(
      input.barberId !== null
        ? and(eq(barbers.id, input.barberId), eq(barbers.active, true))
        : eq(barbers.active, true),
    )
    .orderBy(asc(barbers.id));
  if (candidates.length === 0) {
    // Barbeiro específico inexistente/inativo: não encontrado. "Sem preferência" e ninguém ativo:
    // nenhum horário disponível.
    if (input.barberId === null) throw new SlotTakenError();
    throw new NotFoundError('Barbeiro');
  }
  if (input.barberId === null && candidates.length > 1) {
    // Sem preferência: o barbeiro com MENOS confirmados no dia local; empate pelo menor id.
    const tz = input.timezone ?? DEFAULT_TIMEZONE;
    const day = utcToLocalDate(input.startAt, tz);
    const rows = await db
      .select({ barberId: bookings.barberId, n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          gte(bookings.startAt, localToUtc(day, '00:00', tz)),
          lt(bookings.startAt, localToUtc(nextLocalDate(day), '00:00', tz)),
        ),
      )
      .groupBy(bookings.barberId);
    const load = new Map(rows.map((r) => [r.barberId, r.n]));
    candidates = [...candidates].sort(
      (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.id - b.id,
    );
  }

  const endAt = new Date(input.startAt.getTime() + service.durationMin * MIN);
  for (const c of candidates) {
    try {
      return await insertBookingTx(db, {
        serviceId: service.id,
        barberId: c.id,
        startAt: input.startAt,
        endAt,
        name,
        phone,
        now,
      });
    } catch (err) {
      if (!(err instanceof SlotTakenError)) throw err;
    }
  }
  throw new SlotTakenError();
}

/** Visão pública (ADR-008): só primeiro nome, sem telefone. */
export type PublicBooking = {
  id: number;
  customerFirstName: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  service: { id: number; name: string; durationMin: number; priceCents: number };
  barber: { id: number; name: string };
  canManage: boolean;
};

export async function getBookingByToken(
  db: Executor,
  token: string,
  now: Date = new Date(),
): Promise<PublicBooking | null> {
  const [r] = await db
    .select({
      b: bookings,
      serviceName: services.name,
      durationMin: services.durationMin,
      priceCents: services.priceCents,
      barberName: barbers.name,
    })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(barbers, eq(barbers.id, bookings.barberId))
    .where(eq(bookings.manageTokenHash, hashToken(token)));
  if (!r) return null;
  return {
    id: r.b.id,
    customerFirstName: r.b.customerName.trim().split(/\s+/)[0] ?? '',
    startAt: r.b.startAt,
    endAt: r.b.endAt,
    status: r.b.status,
    service: {
      id: r.b.serviceId,
      name: r.serviceName,
      durationMin: r.durationMin,
      priceCents: r.priceCents,
    },
    barber: { id: r.b.barberId, name: r.barberName },
    canManage: r.b.status === 'confirmed' && canManage(r.b.startAt, now),
  };
}

/** Trava a linha do agendamento dentro da transação (serializa cancelar x reagendar). */
async function lockByToken(tx: Tx, token: string) {
  const [b] = await tx
    .select()
    .from(bookings)
    .where(eq(bookings.manageTokenHash, hashToken(token)))
    .for('update');
  if (!b) throw new NotFoundError('Agendamento');
  return b;
}

/** Cancelamento pelo cliente (RN04). Libera o horário apagando o busy_period. */
export async function cancelBooking(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<BookingSummary> {
  return db.transaction(async (tx) => {
    const b = await lockByToken(tx, token);
    if (b.status !== 'confirmed') throw new InvalidStateError();
    if (!canManage(b.startAt, now)) throw new TooLateError();
    await tx.delete(busyPeriods).where(eq(busyPeriods.bookingId, b.id));
    const [u] = await tx
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: now })
      .where(eq(bookings.id, b.id))
      .returning();
    return u;
  });
}

/**
 * Reagendamento pelo cliente (RN02/RN03/RN04), mesmo barbeiro e serviço.
 * Uma transação: apaga o busy_period antigo e cria o novo. Se o novo conflitar, tudo é desfeito.
 */
export async function rescheduleBooking(
  db: Db,
  token: string,
  newStartAt: Date,
  opts: { now?: Date; timezone?: string } = {},
): Promise<BookingSummary> {
  const now = opts.now ?? new Date();
  try {
    return await transact(db, async (tx) => {
      const b = await lockByToken(tx, token);
      await lockBarber(tx, b.barberId);
      if (b.status !== 'confirmed') throw new InvalidStateError();
      if (!canManage(b.startAt, now)) throw new TooLateError();
      // Duração ORIGINAL do agendamento (o serviço pode ter sido editado ou desativado depois).
      const durationMin = Math.round((b.endAt.getTime() - b.startAt.getTime()) / MIN);
      const check = checkBookingStart({
        start: newStartAt,
        durationMin,
        openingHours: await loadHours(tx),
        now,
        timezone: opts.timezone,
      });
      if (check !== 'ok') throw new InvalidSlotError(check);
      const newEnd = new Date(newStartAt.getTime() + durationMin * MIN);
      await tx.delete(busyPeriods).where(eq(busyPeriods.bookingId, b.id));
      await tx.insert(busyPeriods).values({
        barberId: b.barberId,
        period: rangeSql(newStartAt, newEnd) as unknown as string,
        bookingId: b.id,
      });
      const [u] = await tx
        .update(bookings)
        .set({ startAt: newStartAt, endAt: newEnd })
        .where(eq(bookings.id, b.id))
        .returning();
      return u;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new SlotTakenError();
    throw err;
  }
}

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ['cancelled', 'completed', 'no_show'],
  completed: ['no_show'],
  no_show: ['completed'],
  cancelled: [],
};

/** Ação do admin (sem RN04). `cancelled` libera o horário; demais estados mantêm o período. */
export async function markBookingStatus(
  db: Db,
  bookingId: number,
  status: BookingStatus,
  now: Date = new Date(),
): Promise<BookingSummary> {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update');
    if (!b) throw new NotFoundError('Agendamento');
    if (!TRANSITIONS[b.status].includes(status)) throw new InvalidStateError();
    if ((status === 'completed' || status === 'no_show') && b.startAt > now) {
      throw new InvalidStateError(
        'Não é possível concluir ou marcar falta de um atendimento futuro.',
      );
    }
    if (status === 'cancelled') {
      await tx.delete(busyPeriods).where(eq(busyPeriods.bookingId, b.id));
    }
    const [u] = await tx
      .update(bookings)
      .set({ status, cancelledAt: status === 'cancelled' ? now : b.cancelledAt })
      .where(eq(bookings.id, b.id))
      .returning();
    return u;
  });
}

// ---------- Bloqueios ----------

/** Conflito com agendamento ou outro bloqueio vira BlockConflictError (cancele o agendamento antes). */
export async function createTimeBlock(
  db: Db,
  input: {
    barberId: number;
    startAt: Date;
    endAt: Date;
    reason?: string;
    createdBy?: number | null;
  },
) {
  if (!(input.endAt > input.startAt)) throw new InvalidInputError('Período inválido.');
  const [barber] = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(eq(barbers.id, input.barberId));
  if (!barber) throw new NotFoundError('Barbeiro');
  try {
    return await transact(db, async (tx) => {
      await lockBarber(tx, input.barberId);
      const [blk] = await tx
        .insert(timeBlocks)
        .values({
          barberId: input.barberId,
          startAt: input.startAt,
          endAt: input.endAt,
          reason: input.reason?.trim().slice(0, 200) ?? '',
          createdBy: input.createdBy ?? null,
        })
        .returning();
      await tx.insert(busyPeriods).values({
        barberId: input.barberId,
        period: rangeSql(input.startAt, input.endAt) as unknown as string,
        blockId: blk.id,
      });
      return blk;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new BlockConflictError();
    throw err;
  }
}

/** O busy_period some por ON DELETE CASCADE. */
export async function deleteTimeBlock(db: Db, blockId: number): Promise<void> {
  const rows = await db
    .delete(timeBlocks)
    .where(eq(timeBlocks.id, blockId))
    .returning({ id: timeBlocks.id });
  if (rows.length === 0) throw new NotFoundError('Bloqueio');
}

// ---------- Agenda (admin) ----------

export async function listAgenda(
  db: Executor,
  input: { barberId?: number | null; from: Date; to: Date },
) {
  const barberFilter = (col: AnyPgColumn) => (input.barberId ? eq(col, input.barberId) : undefined);
  const [rows, blocks] = await Promise.all([
    db
      .select({
        id: bookings.id,
        barberId: bookings.barberId,
        barberName: barbers.name,
        serviceName: services.name,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        status: bookings.status,
      })
      .from(bookings)
      .innerJoin(barbers, eq(barbers.id, bookings.barberId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(
        and(
          lt(bookings.startAt, input.to),
          gt(bookings.endAt, input.from),
          barberFilter(bookings.barberId),
        ),
      )
      .orderBy(asc(bookings.startAt)),
    db
      .select()
      .from(timeBlocks)
      .where(
        and(
          lt(timeBlocks.startAt, input.to),
          gt(timeBlocks.endAt, input.from),
          barberFilter(timeBlocks.barberId),
        ),
      )
      .orderBy(asc(timeBlocks.startAt)),
  ]);
  return { bookings: rows, blocks };
}

// ---------- LGPD (RN06) ----------

/** Cancelados são anonimizados mais cedo: 30 dias após `cancelledAt`. */
export const CANCELLED_RETENTION_DAYS = 30;

/**
 * Anonimiza agendamentos encerrados há mais de `days` dias (e cancelados há mais de 30 dias após o
 * cancelamento) e limpa o motivo de bloqueios antigos. Invalida o link (token trocado).
 * Retorna o número de agendamentos anonimizados.
 */
export async function anonymizeOldBookings(
  db: Db,
  opts: { days?: number; now?: Date } = {},
): Promise<number> {
  const days = opts.days ?? 90;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * MIN);
  const cancelledCutoff = new Date(now.getTime() - CANCELLED_RETENTION_DAYS * 24 * 60 * MIN);
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(bookings)
      .set({
        customerName: 'Anonimizado',
        customerPhone: '',
        manageTokenHash: sql`encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex')`,
        anonymizedAt: now,
      })
      .where(
        and(
          sql`${bookings.anonymizedAt} is null`,
          or(
            and(eq(bookings.status, 'cancelled'), lt(bookings.cancelledAt, cancelledCutoff)),
            and(sql`${bookings.status} <> 'cancelled'`, lt(bookings.endAt, cutoff)),
          ),
        ),
      )
      .returning({ id: bookings.id });
    await tx
      .update(timeBlocks)
      .set({ reason: '' })
      .where(and(lt(timeBlocks.endAt, cutoff), sql`${timeBlocks.reason} <> ''`));
    return rows.length;
  });
}
