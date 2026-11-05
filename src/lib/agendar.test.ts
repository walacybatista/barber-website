import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildDateStrip,
  formatDateLong,
  groupSlots,
  isDateInWindow,
  parseInstant,
} from './agendar.ts';

// 01:00 UTC de 06/11 = 22:00 de 05/11 em America/Sao_Paulo: "hoje" local ainda é 05/11.
const now = new Date('2026-11-06T01:00:00Z');

describe('agendar helpers', () => {
  it('addDays cruza mês e ano', () => {
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('faixa tem 31 dias começando hoje e marca fechados', () => {
    const strip = buildDateStrip(now, new Set([1, 2, 3, 4, 5, 6]));
    expect(strip).toHaveLength(31);
    expect(strip[0].date).toBe('2026-11-05');
    expect(strip.find((d) => d.date === '2026-11-08')?.closed).toBe(true); // domingo
    expect(strip[0].closed).toBe(false);
  });
  it('isDateInWindow rejeita passado, além de 30 dias e lixo', () => {
    expect(isDateInWindow('2026-11-04', now)).toBe(false);
    expect(isDateInWindow('2026-11-05', now)).toBe(true);
    expect(isDateInWindow('2026-12-05', now)).toBe(true);
    expect(isDateInWindow('2026-12-06', now)).toBe(false);
    expect(isDateInWindow('2026-02-31', now)).toBe(false);
    expect(isDateInWindow('abc', now)).toBe(false);
    expect(isDateInWindow(null, now)).toBe(false);
  });
  it('groupSlots separa por período local (UTC-3)', () => {
    const g = groupSlots([
      new Date('2026-11-06T12:00:00Z'), // 09:00
      new Date('2026-11-06T15:00:00Z'), // 12:00
      new Date('2026-11-06T21:00:00Z'), // 18:00
    ]);
    expect(g.map((x) => x.period)).toEqual(['Manhã', 'Tarde', 'Noite']);
    expect(g[0].slots[0].label).toBe('09:00');
  });
  it('formatDateLong inclui o ano só quando pedido', () => {
    expect(formatDateLong('2026-11-14')).not.toContain('2026');
    expect(formatDateLong('2026-11-14', true)).toMatch(/novembro de 2026$/);
  });
  it('parseInstant exige ISO completo', () => {
    expect(parseInstant('2026-11-06T12:00:00.000Z')).toBeInstanceOf(Date);
    expect(parseInstant('amanhã')).toBeNull();
    expect(parseInstant(null)).toBeNull();
  });
});
