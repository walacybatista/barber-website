/**
 * Conversões de fuso sem dependências (Intl). Todo instante é um `Date` (UTC internamente);
 * "hora de parede" local só existe como string `YYYY-MM-DD` / `HH:MM`.
 */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Hora de parede de um instante no fuso dado. */
export function utcToLocalParts(date: Date, timeZone: string = DEFAULT_TIMEZONE): LocalParts {
  const map: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado. */
function offsetMs(date: Date, timeZone: string): number {
  const p = utcToLocalParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Converte data local `YYYY-MM-DD` + hora local `HH:MM` em instante UTC. */
export function localToUtc(date: string, time: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) throw new RangeError(`data/hora inválida: ${date} ${time}`);
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], 0);
  // Duas iterações cobrem fusos com horário de verão (o offset do chute pode diferir do real).
  let result = guess - offsetMs(new Date(guess), timeZone);
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** Data local (`YYYY-MM-DD`) de um instante. */
export function utcToLocalDate(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = utcToLocalParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Valida formato e existência real no calendário (rejeita 2026-02-31). */
export function isValidLocalDate(date: string): boolean {
  const d = DATE_RE.exec(date);
  if (!d) return false;
  const dt = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]));
  return (
    dt.getUTCFullYear() === +d[1] && dt.getUTCMonth() === +d[2] - 1 && dt.getUTCDate() === +d[3]
  );
}

/** Limite de datas aceitas em telas/ações admin (agenda e bloqueios): 2000-01-01 a 2100-12-31. */
export function isAdminDateInRange(date: string): boolean {
  return isValidLocalDate(date) && date >= '2000-01-01' && date <= '2100-12-31';
}

/** Dia da semana (0 = domingo) de uma data local `YYYY-MM-DD`. */
export function weekdayOf(date: string): number {
  const d = DATE_RE.exec(date);
  if (!d) throw new RangeError(`data inválida: ${date}`);
  return new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])).getUTCDay();
}

/** Hora local de um instante, em minutos desde 00:00. */
export function localMinutesOfDay(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = utcToLocalParts(date, timeZone);
  return p.hour * 60 + p.minute;
}
