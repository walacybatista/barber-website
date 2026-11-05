# Cobre Velho Barbearia — barber-website

> **Projeto de portfólio.** A "Cobre Velho Barbearia" é **fictícia**: nome, endereço, telefone, e-mail,
> Instagram, barbeiros, preços, horários e imagens são inventados para demonstração. Não é uma empresa real.
> Por padrão o site não é indexável por buscadores (`PUBLIC_NOINDEX=true`, ver ADR-009).

Site de barbearia com agendamento online próprio (prevenção de conflito de horário no banco) e painel
administrativo.

## Stack

Astro 7 · TypeScript (strict) · Tailwind CSS 4 · Postgres 17 · Drizzle ORM · Vitest · Playwright.
Decisões e justificativas em [`docs/adr/`](docs/adr/README.md); escopo em [`docs/SPEC.md`](docs/SPEC.md);
design em [`docs/design.md`](docs/design.md).

## Requisitos

- Node.js `>=22.23.4` (recomendado 24, ver `.nvmrc`)
- Docker (Postgres de desenvolvimento)

## Rodando localmente

```bash
npm install
cp .env.example .env          # ajuste se necessário
npm run db:up                 # sobe Postgres em 127.0.0.1:5433
npm run db:migrate            # aplica migrações
npm run db:seed               # carrega serviços, barbeiros e horários de src/data/business.ts
npm run dev                   # http://localhost:4321
```

## Qualidade

```bash
npm run validate              # astro check + tsc + lint + prettier + testes unitários
npm run test:integration      # regras de agendamento/auth contra banco de teste (*_test)
npm run test:e2e              # Playwright (porta 4322)
```

## Onde mudar o conteúdo

Todo o conteúdo comercial fica em `src/data/business.ts`. Após alterar serviços, barbeiros ou horários,
rode `npm run db:seed` para sincronizar o banco.

> Documentação completa de operação e publicação será concluída na Fase 10.
