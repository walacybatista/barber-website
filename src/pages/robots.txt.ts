import type { APIRoute } from 'astro';
import { isNoindex, siteUrl } from '@/lib/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const base = siteUrl(site).href.replace(/\/$/, '');
  // ADR-009: enquanto PUBLIC_NOINDEX não for 'false', bloqueia tudo.
  const rules = isNoindex()
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', 'Disallow: /agendamento/', 'Disallow: /admin'];
  const body = [...rules, '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
