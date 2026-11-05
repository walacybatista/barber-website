import type { APIRoute } from 'astro';
import { siteUrl } from '@/lib/site';

export const prerender = true;

/** Páginas públicas indexáveis. /agendamento/* (token) fica de fora de propósito. */
const paths = ['/', '/agendar', '/privacidade'];

export const GET: APIRoute = ({ site }) => {
  const base = siteUrl(site);
  const urls = paths.map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
