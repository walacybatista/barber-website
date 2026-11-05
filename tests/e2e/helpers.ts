import http from 'node:http';
import net from 'node:net';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { assertTestDatabaseUrl } from '../integration/helpers.ts';

// Vazio/NaN caem na porta padrão (playwright.config.ts valida a faixa).
export const E2E_PORT = Number(process.env.E2E_PORT) || 4322;
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

export interface FormResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
}

interface FormOpts {
  /** Substitui o corpo derivado de `fields`. */
  body?: string;
  /** Fixa um Content-Length diferente do real. */
  contentLength?: number;
}

/**
 * POST de formulário (urlencoded) com Origin/Host/Sec-Fetch-Site de um navegador same-origin.
 * `headers` sobrescreve os padrões; valor `''` remove o cabeçalho (ex.: `'Content-Length': ''`
 * força Transfer-Encoding: chunked).
 */
export function postFormResponse(
  path: string,
  fields: Record<string, string> = {},
  headers: Record<string, string> = {},
  opts: FormOpts = {},
): Promise<FormResponse> {
  const body = opts.body ?? new URLSearchParams(fields).toString();
  const merged: Record<string, string> = {
    Host: `localhost:${E2E_PORT}`,
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': String(opts.contentLength ?? Buffer.byteLength(body)),
    ...headers,
  };
  for (const k of Object.keys(merged)) if (merged[k] === '') delete merged[k];
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: 'localhost', port: E2E_PORT, path, method: 'POST', headers: merged },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      },
    );
    req.on('error', reject);
    // req.end(body) sem Content-Length faz o Node calculá-lo e enviá-lo; write()+end() força chunked.
    if (merged['Content-Length'] === undefined) {
      req.write(body);
      req.end();
    } else {
      req.end(body);
    }
  });
}

/** Como `postFormResponse`, mas devolve só o status HTTP. */
export async function postForm(
  path: string,
  fields: Record<string, string> = {},
  headers: Record<string, string> = {},
  opts: FormOpts = {},
): Promise<number> {
  return (await postFormResponse(path, fields, headers, opts)).status;
}

/**
 * POST em socket cru (node:net): só cabeçalhos, com `Content-Length` declarado e SEM corpo.
 * Se o servidor tentasse ler o corpo, esperaria bytes que nunca chegam e o timeout estouraria
 * (status 0).
 */
export function postHeadersOnly(
  path: string,
  declaredLength: number,
  timeoutMs = 3000,
): Promise<{ status: number; elapsedMs: number }> {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const socket = net.connect(E2E_PORT, 'localhost');
    let buf = '';
    let done = false;
    const timer = setTimeout(() => finish(0), timeoutMs);
    function finish(status: number) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ status, elapsedMs: Date.now() - t0 });
    }
    socket.on('connect', () =>
      socket.write(
        [
          `POST ${path} HTTP/1.1`,
          `Host: localhost:${E2E_PORT}`,
          `Origin: ${ORIGIN}`,
          'Sec-Fetch-Site: same-origin',
          'Content-Type: application/x-www-form-urlencoded',
          `Content-Length: ${declaredLength}`,
          'Connection: close',
          '',
          '',
        ].join('\r\n'),
      ),
    );
    socket.on('data', (d) => {
      buf += d.toString('latin1');
      const m = /^HTTP\/1\.1 (\d{3})/.exec(buf);
      if (m) finish(Number(m[1]));
    });
    socket.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
    socket.on('close', () => finish(0));
  });
}
