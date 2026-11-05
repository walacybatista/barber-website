import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, foldLine, formatIcsUtc } from './ics.ts';

const event = {
  uid: 'booking-7@cobrevelho.example',
  start: new Date('2026-11-14T13:00:00.000Z'),
  end: new Date('2026-11-14T13:30:00.000Z'),
  summary: 'Corte clássico, com Rafael; barba',
  location: 'Rua das Tesouras, 123, São Paulo',
  description: 'Linha 1\nLinha 2',
  stamp: new Date('2026-11-05T12:00:00.000Z'),
};

const bytes = (s: string) => new TextEncoder().encode(s).length;
const unfold = (parts: string[]) => parts.map((p, i) => (i ? p.slice(1) : p)).join('');

describe('escapeIcsText', () => {
  it('escapa barra, ponto e vírgula, vírgula e quebras', () => {
    expect(escapeIcsText('a,b;c\\d\ne\r\nf')).toBe('a\\,b\\;c\\\\d\\ne\\nf');
  });
});

describe('escapeIcsText CR', () => {
  it('trata CR isolado como quebra de linha', () => {
    expect(escapeIcsText('a\rb')).toBe('a\\nb');
  });
});

describe('formatIcsUtc', () => {
  it('usa UTC com sufixo Z, sem milissegundos', () => {
    expect(formatIcsUtc(new Date('2026-11-14T13:05:09.123Z'))).toBe('20261114T130509Z');
  });
});

describe('foldLine', () => {
  it('não altera linha curta', () => {
    expect(foldLine('SUMMARY:oi')).toEqual(['SUMMARY:oi']);
  });
  it('dobra em no máximo 75 octetos, com continuação iniciada por espaço', () => {
    const line = 'DESCRIPTION:' + 'a'.repeat(200);
    const parts = foldLine(line);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true);
    expect(unfold(parts)).toBe(line);
  });
  it('não corta emoji (4 octetos, par substituto)', () => {
    const line = 'SUMMARY:' + '😀'.repeat(40);
    const parts = foldLine(line);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    expect(unfold(parts)).toBe(line);
  });
  it('não corta caracteres multibyte', () => {
    const line = 'SUMMARY:' + 'é'.repeat(100);
    const parts = foldLine(line);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    expect(unfold(parts)).toBe(line);
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(event);
  it('usa CRLF e termina com CRLF', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
  it('tem estrutura VCALENDAR/VEVENT, UID e datas em UTC', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('UID:booking-7@cobrevelho.example\r\n');
    expect(ics).toContain('DTSTART:20261114T130000Z\r\n');
    expect(ics).toContain('DTEND:20261114T133000Z\r\n');
    expect(ics).toContain('DTSTAMP:20261105T120000Z\r\n');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });
  it('escapa SUMMARY, LOCATION e DESCRIPTION', () => {
    expect(ics).toContain('SUMMARY:Corte clássico\\, com Rafael\\; barba\r\n');
    expect(ics).toContain('LOCATION:Rua das Tesouras\\, 123\\, São Paulo\r\n');
    expect(ics).toContain('DESCRIPTION:Linha 1\\nLinha 2\r\n');
  });
  it('nenhuma linha passa de 75 octetos', () => {
    const long = buildIcs({ ...event, description: 'x'.repeat(300) });
    for (const l of long.split('\r\n')) expect(bytes(l)).toBeLessThanOrEqual(75);
  });
});
