import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { adminUsers, loginAttempts } from '../../db/schema.ts';
import { RateLimitedError, consumeRateLimit } from '../rate-limit.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { createSession } from './sessions.ts';

export { RateLimitedError };

/** Por IP+usuário (limite "justo"): 5 falhas por janela. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Por IP, qualquer usuário: contém flood de scrypt (CPU) e password spraying. */
export const MAX_ATTEMPTS_PER_IP = 20;
/** Por usuário, qualquer IP: freia ataque distribuído; mais frouxo para não trancar o dono. */
export const MAX_ATTEMPTS_PER_USER = 20;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Mensagem genérica: não revela se o usuário existe. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Usuário ou senha inválidos.');
    this.name = 'InvalidCredentialsError';
  }
}

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

/** Chave do limite por IP+usuário (IP em claro não é guardado). */
export function loginKey(ip: string, username: string): string {
  return `login:pair:${sha(`${ip}\0${username.trim().toLowerCase()}`)}`;
}
export const loginIpKey = (ip: string) => `login:ip:${sha(ip)}`;
export const loginUserKey = (username: string) =>
  `login:user:${sha(username.trim().toLowerCase())}`;

let dummyHash: Promise<string> | undefined;

/**
 * Autentica e abre sessão. Rate limit ATÔMICO: a tentativa é registrada ANTES de verificar a
 * senha (`consumeRateLimit` serializa por chave com advisory lock) e apagada no sucesso.
 * Escolhido em vez de lock em volta do scrypt porque não segura conexão/lock durante ~100 ms
 * de CPU; o check-then-act anterior deixava N logins concorrentes passarem do limite.
 * Falhas 1..5 por IP+usuário são processadas; a 6ª é bloqueada (mesmo com senha correta).
 *
 * Trade-off (DoS do dono): atrás de proxy/CDN sem IP confiável, `ip` vira o do proxy (ou
 * 'unknown') e todos dividem o bucket por IP (20/15 min); o limite por usuário (20/15 min,
 * qualquer IP) permite que um atacante bloqueie o dono por 15 min errando 20 vezes. Aceito:
 * bloqueio temporário é preferível a brute force; configure o IP real do cliente no proxy.
 */
export async function login(
  db: Db,
  input: { username: string; password: string; ip: string; now?: Date },
): Promise<{ sessionId: string; expiresAt: Date; user: { id: number; username: string } }> {
  const now = input.now ?? new Date();
  const username = input.username.trim().toLowerCase();
  const pairKey = loginKey(input.ip, username);
  const [, ipRowId, userRowId] = await consumeRateLimit(
    db,
    [
      { key: pairKey, max: MAX_FAILED_ATTEMPTS, windowMs: ATTEMPT_WINDOW_MS },
      { key: loginIpKey(input.ip), max: MAX_ATTEMPTS_PER_IP, windowMs: ATTEMPT_WINDOW_MS },
      { key: loginUserKey(username), max: MAX_ATTEMPTS_PER_USER, windowMs: ATTEMPT_WINDOW_MS },
    ],
    now,
  );

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
  // Usuário inexistente também paga o custo do scrypt (evita enumeração por tempo).
  dummyHash ??= hashPassword('dummy-password-not-used');
  const ok = await verifyPassword(input.password, user ? user.passwordHash : await dummyHash);
  if (!user || !ok) throw new InvalidCredentialsError();
  // Sucesso: zera o contador do par e devolve a unidade dos buckets por IP/usuário.
  await db.delete(loginAttempts).where(eq(loginAttempts.key, pairKey));
  await db.delete(loginAttempts).where(inArray(loginAttempts.id, [ipRowId, userRowId]));
  const { sessionId, expiresAt } = await createSession(db, user.id, now);
  return { sessionId, expiresAt, user: { id: user.id, username: user.username } };
}

/** Usado pelo script `admin:create`. Usuário sempre minúsculo. */
export async function createAdminUser(db: Db, username: string, password: string) {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(name)) throw new Error('Usuário inválido (3-40: a-z 0-9 . _ -).');
  if (password.length < 10) throw new Error('Senha muito curta (mínimo 10 caracteres).');
  const [u] = await db
    .insert(adminUsers)
    .values({ username: name, passwordHash: await hashPassword(password) })
    .returning({ id: adminUsers.id, username: adminUsers.username });
  return u;
}
