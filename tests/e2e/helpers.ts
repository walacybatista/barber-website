import http from 'node:http';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { assertTestDatabaseUrl } from '../integration/helpers.ts';

export const E2E_PORT = Number(process.env.E2E_PORT ?? 4322);
export const ORIGIN = `http://localhost:${E2E_PORT}`;

/** Apaga login_attempts do banco e2e (o rate limit por IP não deve derrubar a suíte). */
export async function resetLoginAttempts(): Promise<void> {
  loadDotEnv();
  const url = assertTestDatabaseUrl(process.env.E2E_DATABASE_URL, 'E2E_DATABASE_URL');
  if (!/_e2e$/.test(new URL(url).pathname))
    throw new Error('E2E_DATABASE_URL deve terminar em _e2e');
  const { sql } = createDb(url, { max: 1 });
  try {
    await sql`delete from login_attempts`;
  } finally {
    await sql.end();
  }
}

/**
 * POST de formulário (urlencoded) com Origin/Host/Sec-Fetch-Site de um navegador same-origin.
 * `headers` sobrescreve os padrões; valor `''` remove o cabeçalho.
 */
export function postForm(
  path: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<number> {
  const body = new URLSearchParams(fields).toString();
  const merged: Record<string, string> = {
    Host: `localhost:${E2E_PORT}`,
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': String(Buffer.byteLength(body)),
    ...headers,
  };
  for (const k of Object.keys(merged)) if (merged[k] === '') delete merged[k];
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: 'localhost', port: E2E_PORT, path, method: 'POST', headers: merged },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}
