import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';
import { ConfigError } from '../lib/log.ts';

export type Db = ReturnType<typeof createDb>['db'];
export type Sql = ReturnType<typeof postgres>;

/**
 * Segredos de servidor vêm SOMENTE de `process.env`, em tempo de execução. NUNCA use
 * `import.meta.env[name]` dinâmico: o Vite embute o env inteiro do build no bundle do servidor
 * (vaza `DATABASE_URL` em `dist/`) e o valor embutido vence o runtime. O `.env` é carregado
 * em dev/scripts por `loadDotEnv()` (não sobrescreve variáveis já definidas).
 */
export function readEnv(name: string): string | undefined {
  return process.env[name];
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
    // `astro dev` só expõe o .env em import.meta.env (não em process.env): carrega aqui.
    // Em produção o ambiente é a única fonte: sem DATABASE_URL, falha com mensagem clara.
    if (!readEnv('DATABASE_URL') && process.env.NODE_ENV !== 'production') loadDotEnv();
    const url = readEnv('DATABASE_URL');
    if (!url) {
      throw new ConfigError(
        'DATABASE_URL não definida. Defina no ambiente (em dev: copie .env.example para .env).',
      );
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
