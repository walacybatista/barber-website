import type { AstroGlobal } from 'astro';

/**
 * Defesa em profundidade (além do middleware): toda página admin chama isto primeiro.
 * Sem sessão devolve um redirect 303 com `no-store`; com sessão devolve o admin.
 *   const guard = requireAdmin(Astro);
 *   if (guard.response) return guard.response;
 *   const { admin } = guard;
 */
export function noStoreRedirect(Astro: AstroGlobal, to: string): Response {
  const res = Astro.redirect(to, 303);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function requireAdmin(
  Astro: AstroGlobal,
):
  | { admin: NonNullable<App.Locals['admin']>; response?: undefined }
  | { admin?: undefined; response: Response } {
  const admin = Astro.locals.admin;
  if (!admin) return { response: noStoreRedirect(Astro, '/admin/login') };
  return { admin };
}
