/** Helpers puros do fluxo /agendar (datas locais, janela de 30 dias, agrupamento de horários). */
import {
  DEFAULT_TIMEZONE,
  isValidLocalDate,
  utcToLocalDate,
  utcToLocalParts,
  weekdayOf,
} from './time/tz.ts';

const MS_DAY = 86_400_000;

/** Soma dias a uma data local `YYYY-MM-DD` (calendário, sem fuso). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * MS_DAY).toISOString().slice(0, 10);
}

export type StripDay = {
  date: string;
  weekday: string;
  day: string;
  month: string;
  /** Fechado nesse dia da semana (sem expediente). */
  closed: boolean;
};

const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: DEFAULT_TIMEZONE,
});

const noDot = (s: string) => s.replace('.', '');
const noonUtc = (date: string) => new Date(`${date}T12:00:00Z`);

/** "quinta-feira, 14 de novembro" (com `withYear`: "... de novembro de 2026"). */
export function formatDateLong(date: string, withYear = false): string {
  const text = longFmt.format(noonUtc(date));
  return withYear ? `${text} de ${date.slice(0, 4)}` : text;
}

/** "09:15" no fuso da barbearia. */
export function formatTime(instant: Date): string {
  return timeFmt.format(instant);
}

/** Data e hora locais por extenso a partir de um instante. */
export function formatDateTimeLong(instant: Date, withYear = false): string {
  return `${formatDateLong(utcToLocalDate(instant), withYear)}, às ${formatTime(instant)}`;
}

export function periodOf(instant: Date): 'Manhã' | 'Tarde' | 'Noite' {
  const h = utcToLocalParts(instant).hour;
  return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite';
}

/** Faixa de datas locais: de hoje até hoje + 30 dias (RN03), marcando dias sem expediente. */
export function buildDateStrip(now: Date, openWeekdays: Set<number>): StripDay[] {
  const today = utcToLocalDate(now);
  return Array.from({ length: 31 }, (_, i) => {
    const date = addDays(today, i);
    const dt = noonUtc(date);
    return {
      date,
      weekday: noDot(weekdayFmt.format(dt)),
      day: String(Number(date.slice(8))),
      month: noDot(monthFmt.format(dt)),
      closed: !openWeekdays.has(weekdayOf(date)),
    };
  });
}

/** Data do parâmetro `data`: formato válido, existente e dentro da janela [hoje, hoje+30]. */
export function isDateInWindow(date: string | null | undefined, now: Date): date is string {
  if (!date || !isValidLocalDate(date)) return false;
  const today = utcToLocalDate(now);
  return date >= today && date <= addDays(today, 30);
}

export type Slot = { iso: string; label: string };

/** Agrupa horários por período (Manhã, Tarde, Noite), mantendo a ordem. */
export function groupSlots(starts: Date[]): { period: string; slots: Slot[] }[] {
  const groups = new Map<string, Slot[]>();
  for (const s of starts) {
    const p = periodOf(s);
    const list = groups.get(p) ?? [];
    list.push({ iso: s.toISOString(), label: formatTime(s) });
    groups.set(p, list);
  }
  return ['Manhã', 'Tarde', 'Noite']
    .filter((p) => groups.has(p))
    .map((period) => ({ period, slots: groups.get(period)! }));
}

/** Instante ISO do parâmetro `hora`, ou null. */
export function parseInstant(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
