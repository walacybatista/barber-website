const DEV_FALLBACK = 'http://localhost:4321';

/**
 * URL pública do site (de `site` em astro.config, que lê SITE_URL).
 * Em build/produção a ausência de SITE_URL é erro: canonical, sitemap e Open Graph apontariam
 * para localhost. Em dev usa http://localhost:4321.
 */
export function siteUrl(site?: URL): URL {
  if (site) return site;
  if (import.meta.env.PROD) {
    throw new Error(
      'SITE_URL ausente: defina SITE_URL (ex.: https://seu-dominio.com.br) no ambiente de build/produção.',
    );
  }
  return new URL(DEV_FALLBACK);
}

/** `noindex` ligado por padrão (ADR-009); só `PUBLIC_NOINDEX=false` libera a indexação. */
export function isNoindex(): boolean {
  return import.meta.env.PUBLIC_NOINDEX !== 'false';
}
