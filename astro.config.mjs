// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// O Astro só carrega o .env depois desta config; lemos SITE_URL aqui.
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

// https://astro.build/config
// Em produção sem SITE_URL o `site` fica indefinido e siteUrl() (src/lib/site.ts) falha o build.
const isProd = process.env.NODE_ENV === 'production';
const site = process.env.SITE_URL ?? env.SITE_URL ?? (isProd ? undefined : 'http://localhost:4321');

// ALLOWED_DOMAIN: lista separada por vírgula (um host por item; espaços aparados, itens vazios
// ignorados). É avaliada NO BUILD (security.allowedDomains entra na config compilada), então
// defina-a no ambiente do build, não só em runtime. É OBRIGATÓRIA atrás de proxy: sem ela o
// Astro ignora X-Forwarded-For e o rate limit por IP colapsa no IP do proxy.
const allowedDomains = (process.env.ALLOWED_DOMAIN ?? env.ALLOWED_DOMAIN ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((hostname) => ({ hostname }));

export default defineConfig({
  site,
  adapter: node({ mode: 'standalone', bodySizeLimit: 64 * 1024 }),
  // actionBodySizeLimit: o handler de Actions lê o corpo antes da página; o formulário de
  // agendamento tem poucos campos, então 16 KB é folga ampla (padrão do Astro: 1 MiB). ADR-010.
  security: {
    checkOrigin: true,
    actionBodySizeLimit: 16 * 1024,
    // CSP (ADR-011 S4). O Astro gera hashes SHA-256 dos <script>/<style> inline do build, mas NÃO
    // de `<script is:inline>` em páginas SSR (verificado: o hash faltava no header). Por isso o
    // script de src/layouts/BaseLayout.astro (classe `js`) tem hash declarado abaixo.
    // script-src/style-src NÃO levam 'unsafe-inline'.
    // Recalcular (o texto entre <script> e </script>, sem aspas, byte a byte):
    //   node -e "console.log('sha256-'+require('crypto').createHash('sha256').update(\"document.documentElement.classList.add('js');\").digest('base64'))"
    // O teste tests/e2e/csp.spec.ts falha se o hash divergir do script renderizado.
    // Páginas prerenderizadas recebem <meta http-equiv>; páginas SSR recebem o header
    // Content-Security-Policy (o adaptador Node repassa). Não use style="" nem on*="" nos
    // componentes: atributos inline não são cobertos por hash.
    csp: {
      algorithm: 'SHA-256',
      scriptDirective: {
        hashes: ['sha256-/x7W7R75k8Roq0WaVRQX9blP4OufE5xbAdzklGxsgpw='],
      },
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        'frame-src https://maps.google.com https://www.google.com',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
    // Só com ALLOWED_DOMAIN: valida Host/X-Forwarded-Host (evita host-header poisoning) e habilita
    // X-Forwarded-For. Sem ela, comportamento anterior.
    ...(allowedDomains.length ? { allowedDomains } : {}),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
