// Uso: ADMIN_PASSWORD='...' npm run admin:create -- <usuario>
//      ou: npm run admin:create -- <usuario>   (senha lida do stdin; sem eco se for terminal)
// A senha NUNCA vai por argumento: argv aparece em `ps`, histórico do shell e logs de CI.
import { createDb, loadDotEnv, readEnv } from '../src/db/client.ts';
import { createAdminUser } from '../src/lib/auth/login.ts';

loadDotEnv();
const username = process.argv[2];
if (!username) {
  console.error('Uso: npm run admin:create -- <usuario>   (senha em ADMIN_PASSWORD ou stdin)');
  process.exit(1);
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.stdin.isTTY) {
    return new Promise((resolve) => {
      process.stdout.write('Senha (sem eco): ');
      let buf = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function onData(ch: string) {
        for (const c of ch) {
          if (c === '\r' || c === '\n' || c === '\u0004') {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.off('data', onData);
            process.stdout.write('\n');
            return resolve(buf);
          }
          if (c === '\u0003') process.exit(130);
          if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1);
          else buf += c;
        }
      });
    });
  }
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}

const url = readEnv('DATABASE_URL');
if (!url) throw new Error('DATABASE_URL não definida.');
const password = await readPassword();
const { db, sql } = createDb(url, { max: 1 });
try {
  const u = await createAdminUser(db, username, password);
  console.log(`admin criado: ${u.username} (id ${u.id})`);
} catch (err) {
  const code = (err as { code?: string; cause?: { code?: string } }).cause?.code;
  console.error(code === '23505' ? 'Usuário já existe.' : (err as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
