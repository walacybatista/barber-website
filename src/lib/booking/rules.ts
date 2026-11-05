import {
  DEFAULT_TIMEZONE,
  isValidLocalDate,
  localMinutesOfDay,
  localToUtc,
  utcToLocalDate,
  utcToLocalParts,
  weekdayOf,
} from '../time/tz.ts';

export const SLOT_STEP_MIN = 15;
export const MIN_LEAD_MIN = 30; // RN03
export const MAX_DAYS_AHEAD = 30; // RN03
export const MANAGE_CUTOFF_MIN = 120; // RN04

const MIN = 60_000;

export type OpeningHour = { weekday: number; open: string; close: string };
export type BusyPeriod = { start: Date; end: Date };

/** Janela de agendamento (RN03): [agora + 30 min, agora + 30 dias]. */
export function bookingWindow(now: Date): { earliest: Date; latest: Date } {
  return {
    earliest: new Date(now.getTime() + MIN_LEAD_MIN * MIN),
    latest: new Date(now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * MIN),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function overlaps(aStart: Date, aEnd: Date, busy: BusyPeriod[]): boolean {
  return busy.some((b) => aStart < b.end && b.start < aEnd);
}

/** Intervalos de funcionamento (minutos locais) de uma data local. */
function intervalsFor(date: string, openingHours: OpeningHour[]) {
  const wd = weekdayOf(date);
  return openingHours
    .filter((h) => h.weekday === wd)
    .map((h) => ({ open: toMinutes(h.open), close: toMinutes(h.close) }))
    .filter((i) => i.close > i.open);
}

export type ComputeSlotsInput = {
  /** Data local `YYYY-MM-DD`. */
  date: string;
  service: { durationMin: number };
  /** Períodos ocupados (agendamentos + bloqueios) do barbeiro em questão. */
  busy: BusyPeriod[];
  openingHours: OpeningHour[];
  now: Date;
  timezone?: string;
};

/**
 * Inícios livres (instantes UTC) de UM barbeiro numa data local, de 15 em 15 min.
 * O chamador passa em `busy` só os períodos desse barbeiro.
 * Regras: RN01 (sem sobreposição; fim exclusivo), RN02 (dentro do expediente, passo de 15 min),
 * RN03 (>= agora+30min e <= agora+30 dias).
 */
export function computeAvailableSlots(input: ComputeSlotsInput): Date[] {
  const { date, service, busy, openingHours, now, timezone = DEFAULT_TIMEZONE } = input;
  if (!isValidLocalDate(date)) return [];
  if (!Number.isInteger(service.durationMin) || service.durationMin <= 0) return [];
  const { earliest, latest } = bookingWindow(now);
  const slots: Date[] = [];
  for (const { open, close } of intervalsFor(date, openingHours)) {
    // Defesa: abertura desalinhada (ex. 09:10) começa no próximo múltiplo de 15 (o banco também veta).
    const first = Math.ceil(open / SLOT_STEP_MIN) * SLOT_STEP_MIN;
    for (let m = first; m + service.durationMin <= close; m += SLOT_STEP_MIN) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const start = localToUtc(date, `${hh}:${mm}`, timezone);
      const end = new Date(start.getTime() + service.durationMin * MIN);
      if (start < earliest || start > latest) continue;
      if (overlaps(start, end, busy)) continue;
      slots.push(start);
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

export type SlotCheck = 'ok' | 'not_aligned' | 'outside_hours' | 'outside_window';

/** Valida um início de agendamento (RN02 + RN03). Conflito (RN01) é responsabilidade do banco. */
export function checkBookingStart(input: {
  start: Date;
  durationMin: number;
  openingHours: OpeningHour[];
  now: Date;
  timezone?: string;
}): SlotCheck {
  const { start, durationMin, openingHours, now, timezone = DEFAULT_TIMEZONE } = input;
  if (Number.isNaN(start.getTime())) return 'not_aligned';
  const p = utcToLocalParts(start, timezone);
  if (p.second !== 0 || start.getTime() % 1000 !== 0 || p.minute % SLOT_STEP_MIN !== 0) {
    return 'not_aligned';
  }
  const { earliest, latest } = bookingWindow(now);
  if (start < earliest || start > latest) return 'outside_window';
  const date = utcToLocalDate(start, timezone);
  const startMin = localMinutesOfDay(start, timezone);
  const fits = intervalsFor(date, openingHours).some(
    (i) => startMin >= i.open && startMin + durationMin <= i.close,
  );
  return fits ? 'ok' : 'outside_hours';
}

/** RN04: cliente só cancela/reagenda até 2 h antes do início. */
export function canManage(startAt: Date, now: Date): boolean {
  return startAt.getTime() - now.getTime() >= MANAGE_CUTOFF_MIN * MIN;
}

/** Telefone BR normalizado: só dígitos, 10 a 13. `null` se inválido. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}
