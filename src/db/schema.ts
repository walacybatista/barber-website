import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * `tstzrange` não existe no Drizzle: tipo custom. Leitura vem como texto `["2026-...","2026-...")`;
 * a escrita é feita por SQL (`tstzrange($1::timestamptz, $2::timestamptz, '[)')`) no repositório.
 * A EXCLUDE constraint (ADR-006) não é expressável aqui: vive na migração SQL (ver drizzle/).
 */
const tstzrange = customType<{ data: string }>({
  dataType() {
    return 'tstzrange';
  },
});

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const bookingStatus = pgEnum('booking_status', [
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]);

export const barbers = pgTable('barbers', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  bio: text('bio').notNull().default(''),
  specialties: text('specialties')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  photo: text('photo').notNull().default(''),
  active: boolean('active').notNull().default(true),
});

export const services = pgTable(
  'services',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    durationMin: integer('duration_min').notNull(),
    priceCents: integer('price_cents').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    check('services_duration_step', sql`${t.durationMin} > 0 AND ${t.durationMin} % 15 = 0`),
    check('services_price_nonneg', sql`${t.priceCents} >= 0`),
  ],
);

export const openingHours = pgTable(
  'opening_hours',
  {
    id: serial('id').primaryKey(),
    weekday: smallint('weekday').notNull(),
    openTime: time('open_time').notNull(),
    closeTime: time('close_time').notNull(),
  },
  (t) => [
    check('opening_hours_weekday', sql`${t.weekday} BETWEEN 0 AND 6`),
    check('opening_hours_order', sql`${t.closeTime} > ${t.openTime}`),
    check(
      'opening_hours_step',
      sql`extract(epoch from ${t.openTime})::int % 900 = 0 AND extract(epoch from ${t.closeTime})::int % 900 = 0`,
    ),
    uniqueIndex('opening_hours_weekday_open_uq').on(t.weekday, t.openTime),
  ],
);

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
});

export const bookings = pgTable(
  'bookings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id),
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    startAt: tstz('start_at').notNull(),
    endAt: tstz('end_at').notNull(),
    status: bookingStatus('status').notNull().default('confirmed'),
    manageTokenHash: text('manage_token_hash').notNull().unique(),
    consentAt: tstz('consent_at').notNull(),
    createdAt: tstz('created_at').notNull().defaultNow(),
    cancelledAt: tstz('cancelled_at'),
    anonymizedAt: tstz('anonymized_at'),
  },
  (t) => [
    check('bookings_period_order', sql`${t.endAt} > ${t.startAt}`),
    index('bookings_barber_start_idx').on(t.barberId, t.startAt),
    index('bookings_start_idx').on(t.startAt),
  ],
);

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id),
    startAt: tstz('start_at').notNull(),
    endAt: tstz('end_at').notNull(),
    reason: text('reason').notNull().default(''),
    createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('time_blocks_period_order', sql`${t.endAt} > ${t.startAt}`),
    index('time_blocks_barber_start_idx').on(t.barberId, t.startAt),
  ],
);

/** ADR-006. EXCLUDE USING gist (barber_id WITH =, period WITH &&) está na migração SQL. */
export const busyPeriods = pgTable(
  'busy_periods',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id),
    period: tstzrange('period').notNull(),
    bookingId: bigint('booking_id', { mode: 'number' }).references(() => bookings.id, {
      onDelete: 'cascade',
    }),
    blockId: bigint('block_id', { mode: 'number' }).references(() => timeBlocks.id, {
      onDelete: 'cascade',
    }),
  },
  (t) => [
    check('busy_periods_one_owner', sql`num_nonnulls(${t.bookingId}, ${t.blockId}) = 1`),
    check(
      'busy_periods_period_valid',
      sql`NOT isempty(${t.period}) AND NOT lower_inf(${t.period}) AND NOT upper_inf(${t.period})`,
    ),
    uniqueIndex('busy_periods_booking_uq').on(t.bookingId),
    uniqueIndex('busy_periods_block_uq').on(t.blockId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    expiresAt: tstz('expires_at').notNull(),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_expires_idx').on(t.expiresAt)],
);

/**
 * Tabela genérica de rate limit: `key` tem prefixo de uso (`login:*`, `booking:*`) e guarda só hash
 * (nunca IP em claro). Toda tentativa é registrada antes do trabalho caro; no sucesso do login as
 * unidades são devolvidas.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    key: text('key').notNull(),
    attemptedAt: tstz('attempted_at').notNull().defaultNow(),
  },
  (t) => [
    index('login_attempts_key_idx').on(t.key, t.attemptedAt),
    index('login_attempts_attempted_at_idx').on(t.attemptedAt),
  ],
);
