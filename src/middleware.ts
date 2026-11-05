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
  if (sid) {
    const session = await validateSession(getDb(), sid);
    if (session) {
      context.locals.admin = session.user;
      if (session.renewed) {
        context.cookies.set(
          SESSION_COOKIE,
          sid,
          sessionCookieOptions(session.expiresAt, import.meta.env.PROD),
        );
      }
    } else {
      context.cookies.delete(SESSION_COOKIE, { path: '/' });
    }
  }

  if (isAdminPath(pathname) && pathname !== LOGIN_PATH && !context.locals.admin) {
    return context.redirect(LOGIN_PATH);
  }
  return next();
});
