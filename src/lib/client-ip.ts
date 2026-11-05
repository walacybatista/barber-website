import { isIP } from 'node:net';

/** Converte "a.b.c.d" em dois grupos hexadecimais de 16 bits; `null` se inválido. */
function v4ToGroups(v4: string): [string, string] | null {
  if (isIP(v4) !== 4) return null;
  const [a, b, c, d] = v4.split('.').map(Number);
  return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
}

/** Expande um IPv6 (sem zona) em 8 grupos numéricos; `null` se inválido. */
function expandV6(addr: string): number[] | null {
  let s = addr;
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const g = v4ToGroups(tail);
    if (!g) return null;
    s = `${s.slice(0, lastColon + 1)}${g[0]}:${g[1]}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

/**
 * Normaliza o IP para chave de rate limit: IPv4 inalterado; IPv4-mapeado (`::ffff:a.b.c.d`)
 * vira IPv4; IPv6 vira o prefixo /64 (`2001:db8:0:1::/64`), pois um cliente controla o /64
 * inteiro e poderia girar o sufixo para escapar do limite. Zona (`%eth0`) é descartada.
 * Entrada inválida/vazia vira 'unknown' (agrupa, limite mais rígido).
 */
export function normalizeClientIp(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  const addr = raw.trim().split('%')[0];
  if (isIP(addr) === 4) return addr;
  if (!addr.includes(':')) return 'unknown';
  const g = expandV6(addr);
  if (!g) return 'unknown';
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  }
  return `${g
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(':')}::/64`;
}
