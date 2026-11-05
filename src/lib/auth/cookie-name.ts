/**
 * Nome do cookie de sessão, sem dependência de Astro (usável por e2e/scripts).
 * Produção: `__Host-session` (exige secure, path=/, sem domain). Fora dela: `session`.
 */
export function sessionCookieName(prod: boolean): string {
  return prod ? '__Host-session' : 'session';
}
