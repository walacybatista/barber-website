import type { OpeningHours } from '@/data/business';

const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
const SCHEMA_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type HoursRow = { label: string; open: string | null; close: string | null };

/**
 * Agrupa dias consecutivos com o mesmo horário ("Seg a Sex"), na ordem seg..dom.
 * Dias ausentes aparecem como fechados (open/close nulos).
 */
export function groupHours(hours: OpeningHours[]): HoursRow[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const byDay = new Map(hours.map((h) => [h.weekday as number, h]));
  const rows: { days: number[]; open: string | null; close: string | null }[] = [];
  for (const d of order) {
    const h = byDay.get(d);
    const open = h?.open ?? null;
    const close = h?.close ?? null;
    const last = rows[rows.length - 1];
    if (last && last.open === open && last.close === close) last.days.push(d);
    else rows.push({ days: [d], open, close });
  }
  return rows.map(({ days, open, close }) => {
    const first = days[0]!;
    const end = days[days.length - 1]!;
    const label =
      days.length === 1
        ? LONG[first]!
        : days.length === 2
          ? `${SHORT[first]} e ${SHORT[end]}`
          : `${SHORT[first]} a ${SHORT[end]}`;
    return { label, open, close };
  });
}

export function schemaDayName(weekday: number): string {
  return SCHEMA_DAYS[weekday]!;
}
