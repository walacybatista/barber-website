// Falha (exit 1) se o build embutiu segredos em dist/server ou dist/client. Uso: npm run check:dist [dir]
// Nunca imprime o segredo achado: só o arquivo e o padrão (rótulo).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
/** [rótulo, texto procurado] */
const NEEDLES = [
  ['postgres://', 'postgres://'],
  ['postgresql://', 'postgresql://'],
  ['postgres%3A%2F%2F', 'postgres%3A%2F%2F'],
  ['postgres:\\/\\/ (escapado)', 'postgres:\\/\\/'],
  ['ADMIN_PASSWORD', 'ADMIN_PASSWORD'],
  ['DATABASE_URL=', 'DATABASE_URL='],
];

const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  NEEDLES.push(['valor de DATABASE_URL', dbUrl]);
  try {
    const u = new URL(dbUrl);
    // Host loopback e senhas curtas aparecem em qualquer build (ex.: "localhost" no HTML de dev):
    // procurá-los gera falso positivo, e alarme que sempre dispara é ignorado. O valor inteiro cobre esses casos.
    const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (u.hostname && !LOOPBACK.has(u.hostname)) NEEDLES.push(['host de DATABASE_URL', u.hostname]);
    if (u.password && decodeURIComponent(u.password).length >= 8) {
      NEEDLES.push(['senha de DATABASE_URL', u.password]);
      NEEDLES.push(['senha de DATABASE_URL (decodificada)', decodeURIComponent(u.password)]);
    }
  } catch {
    // URL inválida: o valor inteiro já está na lista.
  }
}
if (process.env.ADMIN_PASSWORD)
  NEEDLES.push(['valor de ADMIN_PASSWORD', process.env.ADMIN_PASSWORD]);

const hits = [];
let filesRead = 0;
const missing = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const text = readFileSync(p, 'utf8'); // utf8: senhas não-ASCII também casam
      filesRead++;
      for (const [label, needle] of NEEDLES)
        if (needle && text.includes(needle)) hits.push(`${p}: ${label}`);
    }
  }
}

for (const sub of ['server', 'client']) {
  const d = join(root, sub);
  try {
    if (!statSync(d).isDirectory()) throw Object.assign(new Error(), { code: 'ENOENT' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      missing.push(d);
      continue;
    }
    throw err;
  }
  walk(d);
}
if (missing.length) {
  console.error(`check:dist falhou: diretório ausente (rode npm run build): ${missing.join(', ')}`);
  process.exit(1);
}
if (filesRead === 0) {
  console.error('check:dist falhou: nenhum arquivo lido (build vazio?).');
  process.exit(1);
}
if (hits.length) {
  console.error('Segredos encontrados no build:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(
  `check:dist ok (${filesRead} arquivos em ${root}/server e ${root}/client sem segredos)`,
);
