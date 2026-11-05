/** Gerador de iCalendar (RFC 5545) puro: sem dependências. Só lê o relógio (DTSTAMP) se `stamp` não vier; passe `stamp` para saída determinística. */

export type IcsEvent = {
  /** Estável por agendamento: reimportar o arquivo atualiza o evento em vez de duplicar. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  /** Instante de geração (DTSTAMP). Padrão: agora. */
  stamp?: Date;
};

const encoder = new TextEncoder();

/** Escapa texto TEXT (RFC 5545 3.3.11): barra, ponto e vírgula, vírgula e quebras de linha. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** `YYYYMMDDTHHMMSSZ` em UTC. */
export function formatIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/** Dobra a linha em partes de no máximo 75 octetos UTF-8 (continuação começa com 1 espaço), sem cortar caractere. */
export function foldLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts;
}

/** Monta o VCALENDAR com um VEVENT. Linhas terminam em CRLF, inclusive a última. */
export function buildIcs(event: IcsEvent, prodId = '-//Cobre Velho//Agendamento//PT-BR'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsUtc(event.stamp ?? new Date())}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
    `DTEND:${formatIcsUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}
