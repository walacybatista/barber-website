import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Formato: scrypt$N$r$p$saltBase64$hashBase64 (parâmetros ficam no hash: permite subir o custo depois).
export const SCRYPT_N = 2 ** 17;
const N = SCRYPT_N;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2; // 256 MiB: o scrypt usa ~128*N*r (128 MiB)

/**
 * Semáforo simples (FIFO, sem dependência). Cada scrypt usa ~128 MiB; sem limite, logins
 * concorrentes estouram a memória do processo. `peak` existe para teste.
 */
export function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const limiter = {
    peak: 0,
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
      else active++; // vaga reservada; quem sai da fila herda a vaga de quem terminou
      limiter.peak = Math.max(limiter.peak, active);
      try {
        return await task();
      } finally {
        const next = queue.shift();
        if (next) next();
        else active--;
      }
    },
  };
  return limiter;
}

const SCRYPT_MAX_CONCURRENT = 2;
export const scryptLimiter = createLimiter(SCRYPT_MAX_CONCURRENT);

/** Todo scrypt do processo (hash, verify e o dummy anti-enumeração do login) passa por aqui. */
function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return scryptLimiter.run(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize('NFKC'), salt, KEYLEN, opts, (err, key) =>
          err ? reject(err) : resolve(key),
        );
      }),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![n, r, p].every(Number.isInteger)) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length === 0) return false;
  try {
    const key = await derive(password, salt, { N: n, r, p, maxmem: 128 * n * r * 2 });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/** true quando o hash armazenado usa parâmetros diferentes dos atuais (rehash transparente no login). */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  return Number(parts[1]) !== N || Number(parts[2]) !== R || Number(parts[3]) !== P;
}
