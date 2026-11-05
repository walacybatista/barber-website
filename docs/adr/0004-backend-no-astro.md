# ADR-004 — Backend no próprio Astro, adaptador Node

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead

## Contexto
O agendamento precisa de servidor (consultar horários livres, gravar reservas, painel). A hospedagem ainda
não foi escolhida.

## Decisão
Mesmo projeto Astro. Páginas de marketing são pré-renderizadas; `/agendar`, `/agendamento/[token]`,
`/admin/**` e as Actions usam `export const prerender = false`. Adaptador `@astrojs/node` (modo standalone).
Formulários via **Astro Actions** com validação zod (`astro:schema`), que valida no servidor.

## Organização
```
src/
  pages/          rotas (marketing estático; agendar/admin on-demand)
  components/     UI reutilizável
  actions/        Astro Actions (fronteira HTTP fina: valida e chama lib/)
  lib/            regras de negócio puras + acesso a dados (testáveis sem HTTP)
  db/             schema Drizzle, cliente, seed
  data/           conteúdo estático da barbearia
  middleware.ts   sessão do admin e proteção de /admin
```

## Alternativas
- **API separada (Express/Nest):** dois deploys, CORS, tipos duplicados. Desnecessário nesse porte.

## Consequências
- (+) Um repositório, um deploy, tipos compartilhados.
- (+) Trocar Node por Vercel/Netlify = trocar o adaptador.
- (−) Em serverless, conexões ao Postgres precisam de pooler (Supabase/Neon fornecem).
