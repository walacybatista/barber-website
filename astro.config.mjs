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

export default defineConfig({
  site,
  adapter: node({ mode: 'standalone' }),
  // actionBodySizeLimit: o handler de Actions lê o corpo antes da página; o formulário de
  // agendamento tem poucos campos, então 16 KB é folga ampla (padrão do Astro: 1 MiB). ADR-010.
  security: { checkOrigin: true, actionBodySizeLimit: 16 * 1024 },
  vite: {
    plugins: [tailwindcss()],
  },
});
