import { defineMiddleware } from 'astro:middleware';
import { getDb } from './db/client.ts';
import { SESSION_COOKIE, sessionCookieOptions, validateSession } from './lib/auth/sessions.ts';

const LOGIN_PATH = '/admin/login';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.admin = null;
  // Páginas estáticas não têm cookies nem sessão; não toca no banco.
  if (context.isPrerendered) return next();

  const { pathname } = context.url;
  const sid = context.cookies.get(SESSION_COOKIE)?.value;
  // Só consulta o banco quando há cookie (qualquer rota) ou em /admin.
  let dbDown = false;
  if (sid) {
    let session: Awaited<ReturnType<typeof validateSession>> = null;
    try {
      session = await validateSession(getDb(), sid);
    } catch (err) {
      // Banco fora: rota pública segue como anônima; /admin responde 503 (abaixo).
      dbDown = true;
      console.error(
        'middleware: falha ao carregar sessão',
        err instanceof Error ? err.message : err,
      );
    }
    if (session) {
      context.locals.admin = session.user;
      if (session.renewed) {
        context.cookies.set(
          SESSION_COOKIE,
          sid,
          sessionCookieOptions(session.expiresAt, import.meta.env.PROD),
        );
      }
    } else if (!dbDown) {
      context.cookies.delete(SESSION_COOKIE, { path: '/' });
    }
  }

  if (isAdminPath(pathname) && dbDown) {
    return new Response('Serviço temporariamente indisponível.', {
      status: 503,
      headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' },
    });
  }
  if (isAdminPath(pathname) && pathname !== LOGIN_PATH && !context.locals.admin) {
    const res = context.redirect(LOGIN_PATH);
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }
  return next();
});
