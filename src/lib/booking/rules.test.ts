import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from './token.ts';
import {
  canManage,
  checkBookingStart,
  computeAvailableSlots,
  normalizePhone,
  type OpeningHour,
} from './rules.ts';
import {
  isValidLocalDate,
  localToUtc,
  utcToLocalDate,
  utcToLocalParts,
  weekdayOf,
} from '../time/tz.ts';

// 2026-11-05 09:00 em São Paulo (UTC-3, sem horário de verão desde 2019).
const NOW = new Date('2026-11-05T12:00:00Z');
const MONDAY = '2026-11-09';
const allDays = (open: string, close: string): OpeningHour[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open, close }));
const hhmm = (d: Date) => {
  const p = utcToLocalParts(d);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};
const local = (date: string, time: string) => localToUtc(date, time);

describe('fuso', () => {
  it('21h locais = 00h UTC do dia seguinte', () => {
    expect(localToUtc('2026-11-09', '21:00').toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(utcToLocalDate(new Date('2026-11-10T00:00:00Z'))).toBe('2026-11-09');
  });
  it('00h local = 03h UTC; ida e volta preservam', () => {
    const d = localToUtc('2026-11-09', '00:00');
    expect(d.toISOString()).toBe('2026-11-09T03:00:00.000Z');
    expect(hhmm(d)).toBe('00:00');
  });
  it('valida datas e dia da semana', () => {
    expect(isValidLocalDate('2026-02-31')).toBe(false);
    expect(isValidLocalDate('2026-2-3')).toBe(false);
    expect(isValidLocalDate('2026-11-09')).toBe(true);
    expect(weekdayOf('2026-11-09')).toBe(1);
  });
  it('rejeita hora inválida', () => {
    expect(() => localToUtc('2026-11-09', '25:00')).toThrow(RangeError);
  });
});

describe('computeAvailableSlots', () => {
  const base = { date: MONDAY, service: { durationMin: 30 }, busy: [], now: NOW };

  it('inclui abertura e último horário que cabe no fechamento', () => {
    const s = computeAvailableSlots({ ...base, openingHours: allDays('09:00', '18:00') });
    expect(hhmm(s[0])).toBe('09:00');
    expect(hhmm(s.at(-1)!)).toBe('17:30');
    expect(s).toHaveLength(35); // inícios 09:00..17:30 de 15 em 15
  });

  it('granularidade de 15 min', () => {
    const s = computeAvailableSlots({ ...base, openingHours: allDays('09:00', '10:00') });
    expect(s.map(hhmm)).toEqual(['09:00', '09:15', '09:30']);
  });

  it('serviço que não cabe antes do fechamento', () => {
    const s = computeAvailableSlots({
      ...base,
      service: { durationMin: 45 },
      openingHours: allDays('09:00', '18:00'),
    });
    expect(hhmm(s.at(-1)!)).toBe('17:15');
    const none = computeAvailableSlots({
      ...base,
      service: { durationMin: 60 },
      openingHours: allDays('09:00', '09:45'),
    });
    expect(none).toEqual([]);
  });

  it('abertura desalinhada (09:10): slots começam em 09:15', () => {
    const s = computeAvailableSlots({ ...base, openingHours: allDays('09:10', '10:00') });
    expect(s.map(hhmm)).toEqual(['09:15', '09:30']);
  });

  it('ocupado parcial: adjacência permitida, sobreposição não', () => {
    const busy = [{ start: local(MONDAY, '10:00'), end: local(MONDAY, '10:30') }];
    const hours = allDays('09:00', '12:00');
    const s30 = computeAvailableSlots({ ...base, busy, openingHours: hours }).map(hhmm);
    expect(s30).toContain('09:30');
    expect(s30).not.toContain('09:45');
    expect(s30).not.toContain('10:00');
    expect(s30).not.toContain('10:15');
    expect(s30).toContain('10:30');
    const s60 = computeAvailableSlots({
      ...base,
      service: { durationMin: 60 },
      busy,
      openingHours: hours,
    }).map(hhmm);
    expect(s60).toContain('09:00');
    expect(s60).not.toContain('09:30');
    expect(s60).toContain('10:30');
  });

  it('respeita intervalo de almoço (dois períodos no mesmo dia)', () => {
    const hours: OpeningHour[] = [
      { weekday: 1, open: '09:00', close: '12:00' },
      { weekday: 1, open: '13:00', close: '14:00' },
    ];
    const s = computeAvailableSlots({ ...base, openingHours: hours }).map(hhmm);
    expect(s).not.toContain('12:00');
    expect(s).toContain('13:00');
    expect(s).toContain('13:30');
    expect(s).not.toContain('13:45');
  });

  it('dia fechado', () => {
    const hours = allDays('09:00', '18:00').filter((h) => h.weekday !== 1);
    expect(computeAvailableSlots({ ...base, openingHours: hours })).toEqual([]);
  });

  it('passado e antecedência mínima de 30 min (RN03)', () => {
    const today = '2026-11-05';
    const now = new Date('2026-11-05T13:00:00Z'); // 10:00 local
    const hours = allDays('09:00', '18:00');
    const s = computeAvailableSlots({ ...base, date: today, now, openingHours: hours }).map(hhmm);
    expect(s[0]).toBe('10:30'); // exatamente agora+30min é permitido
    expect(
      computeAvailableSlots({ ...base, date: '2026-11-04', now, openingHours: hours }),
    ).toEqual([]);
  });

  it('limite de 30 dias (RN03)', () => {
    const hours = allDays('09:00', '18:00');
    const d30 = computeAvailableSlots({ ...base, date: '2026-12-05', openingHours: hours });
    expect(d30.map(hhmm)).toEqual(['09:00']); // agora+30d = 09:00 local; 09:15 já passa
    expect(computeAvailableSlots({ ...base, date: '2026-12-06', openingHours: hours })).toEqual([]);
  });

  it('virada de dia em UTC: 21h local = 00h UTC do dia seguinte', () => {
    const s = computeAvailableSlots({ ...base, openingHours: allDays('20:30', '22:00') });
    expect(s.map((d) => d.toISOString())).toEqual([
      '2026-11-09T23:30:00.000Z',
      '2026-11-09T23:45:00.000Z',
      '2026-11-10T00:00:00.000Z',
      '2026-11-10T00:15:00.000Z',
      '2026-11-10T00:30:00.000Z',
    ]);
    // ocupado 21:00-21:30 local = 00:00-00:30 UTC remove 20:45(sobrepõe? 20:45-21:15 sim) e 21:00, 21:15
    const busy = [
      { start: new Date('2026-11-10T00:00:00Z'), end: new Date('2026-11-10T00:30:00Z') },
    ];
    const s2 = computeAvailableSlots({
      ...base,
      busy,
      openingHours: allDays('20:30', '22:00'),
    }).map(hhmm);
    expect(s2).toEqual(['20:30', '21:30']);
  });

  it('data inválida ou duração inválida não gera horários', () => {
    const hours = allDays('09:00', '18:00');
    expect(computeAvailableSlots({ ...base, date: '2026-02-31', openingHours: hours })).toEqual([]);
    expect(
      computeAvailableSlots({ ...base, service: { durationMin: 0 }, openingHours: hours }),
    ).toEqual([]);
  });
});

describe('checkBookingStart', () => {
  const hours = allDays('09:00', '18:00');
  const c = (start: Date, durationMin = 30) =>
    checkBookingStart({ start, durationMin, openingHours: hours, now: NOW });

  it('ok na abertura e no último horário', () => {
    expect(c(local(MONDAY, '09:00'))).toBe('ok');
    expect(c(local(MONDAY, '17:30'))).toBe('ok');
  });
  it('não alinhado a 15 min', () => {
    expect(c(local(MONDAY, '09:10'))).toBe('not_aligned');
    expect(c(new Date(local(MONDAY, '09:00').getTime() + 1000))).toBe('not_aligned');
  });
  it('fora do expediente / não cabe', () => {
    expect(c(local(MONDAY, '08:45'))).toBe('outside_hours');
    expect(c(local(MONDAY, '17:45'))).toBe('outside_hours');
    expect(c(local(MONDAY, '17:30'), 60)).toBe('outside_hours');
  });
  it('fora da janela', () => {
    expect(c(new Date(NOW.getTime() + 15 * 60_000))).toBe('outside_window');
    expect(c(local('2026-12-06', '09:00'))).toBe('outside_window');
  });
});

describe('RN04 canManage', () => {
  it('permite até 2h antes (inclusive), bloqueia depois', () => {
    const start = new Date('2026-11-09T15:00:00Z');
    expect(canManage(start, new Date('2026-11-09T13:00:00Z'))).toBe(true);
    expect(canManage(start, new Date('2026-11-09T13:00:01Z'))).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('canonicaliza: só dígitos nacionais, sem 55', () => {
    expect(normalizePhone('(11) 91234-5678')).toBe('11912345678');
    expect(normalizePhone('+55 11 91234-5678')).toBe('11912345678');
    expect(normalizePhone('55 (11) 3123-4567')).toBe('1131234567');
    expect(normalizePhone('11 3123-4567')).toBe('1131234567');
  });
  it('rejeita tamanho, DDD e celular inválidos', () => {
    expect(normalizePhone('1234')).toBeNull();
    expect(normalizePhone('1'.repeat(14))).toBeNull();
    expect(normalizePhone('5511912')).toBeNull();
    expect(normalizePhone('(10) 91234-5678')).toBeNull(); // DDD < 11
    expect(normalizePhone('(11) 81234-5678')).toBeNull(); // celular sem 9
    expect(normalizePhone('551191234567890')).toBeNull(); // 15 dígitos
    expect(normalizePhone('55111234567')).toBeNull(); // 11 dígitos: DDD 55, não começa com 9
  });
});

describe('token (RN07)', () => {
  it('32 bytes base64url, hash sha256 hex determinístico', () => {
    const { token, hash } = generateToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
    expect(generateToken().token).not.toBe(token);
  });
});
