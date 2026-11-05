import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Db = ReturnType<typeof createDb>['db'];
export type Sql = ReturnType<typeof postgres>;

/**
 * Astro/Vite expõe .env em `import.meta.env`, não em `process.env`; scripts Node só têm `process.env`.
 * `import.meta.env` é undefined fora do Vite (type stripping), daí o `?.`.
 */
export function readEnv(name: string): string | undefined {
  const fromVite = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  return fromVite ?? process.env[name];
}

/** Carrega `.env` em scripts CLI; só ignora "arquivo não existe". */
export function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export type CreateDbOptions = { max?: number; prepare?: boolean };

/** Fábrica explícita: testes e scripts apontam para qualquer URL e chamam `sql.end()` ao final. */
export function createDb(url: string, options: CreateDbOptions = {}) {
  const sql = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Pooler em transaction mode (Supabase/Neon) exige prepare:false -> DATABASE_PREPARE=false.
    prepare: options.prepare ?? readEnv('DATABASE_PREPARE') !== 'false',
  });
  return { db: drizzle(sql, { schema }), sql };
}

type Cached = ReturnType<typeof createDb>;
const globalCache = globalThis as unknown as { __barberDb?: Cached };

function connection(): Cached {
  // globalThis evita abrir um pool novo a cada reload (HMR) do `astro dev`.
  if (!globalCache.__barberDb) {
    const url = readEnv('DATABASE_URL');
    if (!url) {
      throw new Error('DATABASE_URL não definida. Copie .env.example para .env e ajuste o valor.');
    }
    globalCache.__barberDb = createDb(url);
  }
  return globalCache.__barberDb;
}

/** Conexão padrão (preguiçosa: só falha se for usada sem DATABASE_URL). */
export function getDb(): Db {
  return connection().db;
}

/** Cliente cru, para `sql.end()` em scripts. */
export function getSql(): Sql {
  return connection().sql;
}
