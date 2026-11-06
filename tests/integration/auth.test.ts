import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginAttempts, sessions } from '../../src/db/schema.ts';
import {
  InvalidCredentialsError,
  MAX_ATTEMPTS_PER_IP,
  MAX_ATTEMPTS_PER_USER,
  MAX_FAILED_ATTEMPTS,
  RateLimitedError,
  createAdminUser,
  login,
} from '../../src/lib/auth/login.ts';
import {
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_TTL_MS,
  createSession,
  deleteSession,
  hashSessionId,
  validateSession,
} from '../../src/lib/auth/sessions.ts';
import { createTestDb, resetDb } from './helpers.ts';

const { db, sql } = createTestDb();
const NOW = new Date('2026-11-05T12:00:00Z');
const PASSWORD = 'senha-de-teste-123';
let userId: number;

beforeAll(async () => {
  await resetDb(db);
});
beforeEach(async () => {
  await resetDb(db);
  userId = (await createAdminUser(db, 'Dono', PASSWORD)).id;
});
afterAll(async () => {
  await resetDb(db); // não deixa linhas em barber_test após a suíte
  await sql.end();
});

describe('sessões', () => {
  it('guarda só o hash do ID; sessão válida é aceita', async () => {
    const { sessionId } = await createSession(db, userId, NOW);
    const [row] = await db.select().from(sessions);
    expect(row.idHash).toBe(hashSessionId(sessionId));
    expect(row.idHash).not.toBe(sessionId);
    const s = await validateSession(db, sessionId, NOW);
    expect(s?.user.username).toBe('dono');
    expect(s?.renewed).toBe(false);
  });

  it('sessão expirada é rejeitada (e removida); ID desconhecido também', async () => {
    const { sessionId } = await createSession(db, userId, NOW);
    const after = new Date(NOW.getTime() + SESSION_TTL_MS + 1000);
    expect(await validateSession(db, sessionId, after)).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect(await validateSession(db, 'nao-existe', NOW)).toBeNull();
    expect(await validateSession(db, undefined, NOW)).toBeNull();
  });

  it('renovação deslizante estende a expiração após 1 dia de uso', async () => {
    const { sessionId } = await createSession(db, userId, NOW);
    const later = new Date(NOW.getTime() + 2 * 24 * 3600_000);
    const s = await validateSession(db, sessionId, later);
    expect(s?.renewed).toBe(true);
    expect(s?.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.idHash, hashSessionId(sessionId)));
    expect(row.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
  });

  it('teto absoluto de 30 dias: renovação não ultrapassa e depois dele a sessão morre', async () => {
    const { sessionId } = await createSession(db, userId, NOW);
    const idHash = hashSessionId(sessionId);
    const day = 24 * 3600_000;
    const cap = NOW.getTime() + SESSION_ABSOLUTE_MAX_MS;
    // dia 27: renova, mas limitado ao teto (dia 30), não a 27+7
    await db
      .update(sessions)
      .set({ expiresAt: new Date(NOW.getTime() + 27 * day + 1000) })
      .where(eq(sessions.idHash, idHash));
    const d27 = new Date(NOW.getTime() + 27 * day);
    const s = await validateSession(db, sessionId, d27);
    expect(s?.renewed).toBe(true);
    expect(s?.expiresAt.getTime()).toBe(cap);
    // perto do teto: não renova de novo (nada a estender)
    const d29 = new Date(NOW.getTime() + 29 * day);
    const s2 = await validateSession(db, sessionId, d29);
    expect(s2?.renewed).toBe(false);
    expect(s2?.expiresAt.getTime()).toBe(cap);
    // no teto: rejeitada e removida
    expect(await validateSession(db, sessionId, new Date(cap))).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('teto absoluto vale mesmo com expiresAt no futuro', async () => {
    const { sessionId } = await createSession(db, userId, NOW);
    const later = new Date(NOW.getTime() + SESSION_ABSOLUTE_MAX_MS + 1000);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(later.getTime() + 3600_000) })
      .where(eq(sessions.idHash, hashSessionId(sessionId)));
    expect(await validateSession(db, sessionId, later)).toBeNull();
  });

  it('logout invalida', async () => {
    const { sessionId } = await createSession(db, userId, NOW);
    await deleteSession(db, sessionId);
    expect(await validateSession(db, sessionId, NOW)).toBeNull();
  });
});

// Cada login paga scrypt N=2^17 (semáforo de 2): testes com 20–30 logins levam ~5–22 s (medido 21,3 s).
// O prazo global de 20 s gerava falha intermitente; 90 s dá ~4x de folga sem baixar o custo real do hash.
describe('login e rate limit', { timeout: 90_000 }, () => {
  it('credenciais corretas abrem sessão; erradas dão erro genérico', async () => {
    const ok = await login(db, { username: 'DONO', password: PASSWORD, ip: '1.1.1.1', now: NOW });
    expect(ok.sessionId).toBeTruthy();
    await expect(
      login(db, { username: 'dono', password: 'errada', ip: '1.1.1.1', now: NOW }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      login(db, { username: 'naoexiste', password: 'x', ip: '1.1.1.1', now: NOW }),
    ).rejects.toThrow('Usuário ou senha inválidos.');
  });

  it('bloqueia a 6ª tentativa (mesmo com a senha certa); outro IP não é afetado', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        login(db, { username: 'dono', password: 'errada', ip: '9.9.9.9', now: NOW }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(
      login(db, { username: 'dono', password: PASSWORD, ip: '9.9.9.9', now: NOW }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    await expect(
      login(db, { username: 'dono', password: PASSWORD, ip: '8.8.8.8', now: NOW }),
    ).resolves.toBeDefined();
    // depois da janela de 15 min volta a funcionar
    const later = new Date(NOW.getTime() + 15 * 60_000 + 1000);
    await expect(
      login(db, { username: 'dono', password: PASSWORD, ip: '9.9.9.9', now: later }),
    ).resolves.toBeDefined();
  });

  it('20 erradas concorrentes: no máximo 5 verificam a senha; depois, sucesso impossível', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        login(db, { username: 'dono', password: 'errada', ip: '7.7.7.7', now: NOW }),
      ),
    );
    const isErr = (r: PromiseSettledResult<unknown>, c: new () => Error) =>
      r.status === 'rejected' && r.reason instanceof c;
    expect(results.filter((r) => isErr(r, InvalidCredentialsError))).toHaveLength(
      MAX_FAILED_ATTEMPTS,
    );
    expect(results.filter((r) => isErr(r, RateLimitedError))).toHaveLength(15);
    await expect(
      login(db, { username: 'dono', password: PASSWORD, ip: '7.7.7.7', now: NOW }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('limite por IP independe do usuário: 30 usernames, no máximo 20 verificados', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        login(db, { username: `user${i}`, password: 'x', ip: '6.6.6.6', now: NOW }),
      ),
    );
    const verified = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof InvalidCredentialsError,
    );
    expect(verified).toHaveLength(MAX_ATTEMPTS_PER_IP);
    await expect(
      login(db, { username: 'dono', password: PASSWORD, ip: '6.6.6.6', now: NOW }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('limite por usuário vale entre IPs (20); sucesso devolve as unidades', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_USER; i++) {
      await expect(
        login(db, { username: 'dono', password: 'errada', ip: `10.0.0.${i}`, now: NOW }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(
      login(db, { username: 'dono', password: PASSWORD, ip: '10.0.1.1', now: NOW }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    await db.delete(loginAttempts);
    await login(db, { username: 'dono', password: PASSWORD, ip: '5.5.5.5', now: NOW });
    expect(await db.select().from(loginAttempts)).toHaveLength(0);
  });
});
