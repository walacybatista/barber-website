# ADR-005 — Postgres + Drizzle ORM

- **Data:** 2026-11-05 · **Status:** Aceita (escolha do product owner) · **Agentes:** tech-lead

## Decisão
Postgres 17. Desenvolvimento: container Docker via `docker-compose.yml` (Docker 29 disponível na máquina).
Produção: Supabase ou Neon (a definir com a hospedagem). Drizzle ORM com migrações versionadas por
`drizzle-kit` em `drizzle/`. Driver: `postgres` (postgres.js), compatível com ambos os provedores.

## Alternativas
- **SQLite/libSQL:** zero infraestrutura, mas sem exclusion constraints (ver ADR-006) e uma escrita por vez.
- **Prisma:** maduro, mas mais pesado (engine própria) e menos próximo do SQL.

## Consequências
- (+) Exclusion constraint e `tstzrange` resolvem conflito de horário no banco.
- (+) Migrações em SQL legível, revisáveis em PR.
- (−) Dev depende do Docker rodando.
- Regra: migração em banco de produção **só com aprovação explícita**.
