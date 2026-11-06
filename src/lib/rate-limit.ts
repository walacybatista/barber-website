import { and, eq, gt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { loginAttempts } from '../db/schema.ts';

/** Janela máxima usada por qualquer bucket; registros mais antigos são descartados. */
export const RETENTION_MS = 60 * 60 * 1000;

/** Chance de executar a limpeza a cada consumo (1 em 20). */
export const CLEANUP_PROBABILITY = 1 / 20;

export class RateLimitedError extends Error {
  constructor() {
    super('Muitas tentativas. Tente novamente em alguns minutos.');
    this.name = 'RateLimitedError';
  }
}

export type Bucket = { key: string; max: number; windowMs: number };

/**
 * Consome 1 unidade de cada bucket de forma ATÔMICA: uma transação serializa por chave
 * (`pg_advisory_xact_lock(hashtext(key))`, chaves em ordem para evitar deadlock), confere
 * todas as contagens e só então insere. Se algum bucket estourou, nada é registrado e lança
 * RateLimitedError. A tentativa é registrada ANTES do trabalho caro (scrypt/gravação),
 * e o lock só dura count+insert (não segura conexão durante o scrypt).
 * A tabela `login_attempts` é genérica: o prefixo da chave define o uso (`login:*`, `booking:*`).
 * Retorna os ids inseridos, na ordem de `buckets`.
 */
export async function consumeRateLimit(
  db: Db,
  buckets: Bucket[],
  now: Date = new Date(),
  random: () => number = Math.random,
): Promise<number[]> {
  const sorted = [...buckets].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const ids = await db.transaction(async (tx) => {
    for (const b of sorted) {
      await tx.execute(sql`select pg_advisory_xact_lock(7002, hashtext(${b.key}))`);
    }
    for (const b of sorted) {
      const since = new Date(now.getTime() - b.windowMs);
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(loginAttempts)
        .where(and(eq(loginAttempts.key, b.key), gt(loginAttempts.attemptedAt, since)));
      if ((r?.n ?? 0) >= b.max) throw new RateLimitedError();
    }
    const out = new Map<string, number>();
    for (const b of buckets) {
      const [row] = await tx
        .insert(loginAttempts)
        .values({ key: b.key, attemptedAt: now })
        .returning({ id: loginAttempts.id });
      out.set(b.key, row.id);
    }
    return buckets.map((b) => out.get(b.key)!);
  });
  // Limpeza oportunista fora da transação: best effort, nunca derruba o chamador.
  if (random() < CLEANUP_PROBABILITY) {
    try {
      await db
        .delete(loginAttempts)
        .where(
          sql`${loginAttempts.attemptedAt} < ${new Date(now.getTime() - RETENTION_MS).toISOString()}::timestamptz`,
        );
    } catch {
      // ignorado: a próxima limpeza tenta de novo
    }
  }
  return ids;
}
