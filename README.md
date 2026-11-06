# Cobre Velho Barbearia — barber-website

> **Projeto de portfólio.** A "Cobre Velho Barbearia" é **fictícia**: nome, endereço, telefone, e-mail,
> Instagram, barbeiros, preços, horários e imagens são inventados para demonstração. Não é uma empresa real.
> Por padrão o site não é indexável por buscadores (`PUBLIC_NOINDEX=true`, ver [ADR-009](docs/adr/0009-noindex-portfolio.md)).

Site de barbearia com **agendamento online próprio** e **painel administrativo**:

- **Site público:** apresentação, serviços e preços, barbeiros, galeria, horários, mapa (carregado só ao clicar),
  WhatsApp, política de privacidade, SEO local (JSON-LD `BarberShop`, sitemap).
- **Agendamento** (`/agendar`): serviço → barbeiro (ou sem preferência) → data → horário livre → dados +
  consentimento LGPD. Funciona **sem JavaScript** ([ADR-010](docs/adr/0010-fluxo-agendamento-server-side.md)).
- **Gestão pelo cliente** (`/agendamento/<token>`): ver, cancelar, reagendar (até 2 h antes) e baixar `.ics`.
- **Admin** (`/admin`): login, agenda do dia/semana por barbeiro, concluir / não compareceu / cancelar,
  bloqueios de horário.
- **Sem horário duplicado:** garantido pelo próprio Postgres (`EXCLUDE USING gist`), não só pelo código
  ([ADR-006](docs/adr/0006-conflito-horario.md)).

## Stack

Astro 7 (adaptador Node standalone) · TypeScript strict · Tailwind CSS 4 · Postgres 17 · Drizzle ORM ·
Vitest · Playwright · axe-core. Decisões em [`docs/adr/`](docs/adr/README.md); escopo em
[`docs/SPEC.md`](docs/SPEC.md); design em [`docs/design.md`](docs/design.md).

## Requisitos

- Node.js `>=22.23.4` (recomendado 24 — `.nvmrc`)
- Docker (Postgres de desenvolvimento e testes)

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run db:up                 # Postgres 17 em 127.0.0.1:5433
# bancos de teste (uma vez):
docker compose exec -T db psql -U barber -c "create database barber_test"
docker compose exec -T db psql -U barber -c "create database barber_e2e"
npm run db:migrate            # aplica migrações no banco de dev
npm run db:seed               # serviços, barbeiros e horários a partir de src/data/business.ts
ADMIN_PASSWORD='uma-senha-forte' npm run admin:create -- dono
npm run dev                   # http://localhost:4321
```

A senha do admin vem de `ADMIN_PASSWORD` ou do stdin — **nunca** como argumento (apareceria no histórico do
shell e na lista de processos).

## Qualidade

| Comando | O que faz |
|---|---|
| `npm run validate` | `astro check` + `tsc` + ESLint + Prettier + testes unitários |
| `npm run test:integration` | regras de agendamento, concorrência e auth contra o banco `*_test` |
| `npm run test:e2e` | Playwright no **servidor de produção** (`node dist/server/entry.mjs`), banco `*_e2e`; inclui axe (WCAG 2.1 AA) |

A porta do e2e é `4322`; se estiver ocupada: `E2E_PORT=4324 npm run test:e2e`. Os testes só aceitam bancos com
nome terminado em `_test`/`_e2e` (proteção contra apagar o banco de dev).

## Onde mudar o conteúdo

Todo o conteúdo comercial fica em **`src/data/business.ts`** (fonte única). Depois de alterar serviços, barbeiros
ou horários: `npm run db:seed`. Imagens ficam em `src/assets/` — para trocar por fotos reais, substitua o arquivo
mantendo o nome (a extensão pode mudar).

## Publicação (produção)

Leia antes o checklist de segurança em [ADR-011](docs/adr/0011-postura-de-seguranca.md). Resumo:

Publique **sempre a partir de um commit** (nunca de uma árvore com alterações locais) e rode antes
`npm run validate`, `npm run test:integration` e `npm run test:e2e` nesse commit. O `dist/` local é artefato de
teste — **não publique**; o build de release é feito no ambiente de deploy.

1. **Build** (em ambiente limpo, sem segredos de runtime no ambiente):
   ```bash
   npm ci
   NODE_ENV=production SITE_URL=https://SEU_DOMINIO ALLOWED_DOMAIN=SEU_DOMINIO,www.SEU_DOMINIO npm run build
   npm run check:dist   # obrigatório: falha se houver credencial dentro de dist/
   ```
   `SITE_URL` e `ALLOWED_DOMAIN` são lidos **no build**. Sem `SITE_URL` o build falha de propósito.
   `ALLOWED_DOMAIN` é **obrigatório atrás de proxy** (um item por host servido): sem ele o Astro ignora
   `X-Forwarded-For` e o rate limit por IP colapsa no IP do proxy. Mudar `PUBLIC_*` exige novo build.
2. **Banco:** Postgres gerenciado (Supabase/Neon) com credenciais próprias e `?sslmode=require`
   (`DATABASE_PREPARE=false` se usar pooler em modo transação). A migração `0001` cria a extensão `btree_gist`:
   confirme a permissão no provedor. **Faça backup/snapshot antes.** Ordem no primeiro deploy (migração em
   produção só com aprovação):
   `npm run db:migrate` → `npm run db:seed` → `npm run admin:create -- <usuario>`.
   Esses scripts usam `drizzle-kit` (devDependency) e o código de `src/`: rode-os de um checkout completo com
   `npm ci` (não com `--omit=dev`). Reversão: `0001`–`0003` têm o SQL de reversão em comentário no próprio
   arquivo (remova também a linha correspondente em `drizzle.__drizzle_migrations`); `0000` só por restauração
   de backup.
3. **Execução:** `HOST=127.0.0.1 PORT=4321 DATABASE_URL=... node dist/server/entry.mjs`, exposto **só ao
   proxy**. Variáveis de runtime vêm do ambiente (o servidor não lê `dist/` para segredos).
4. **Proxy reverso (HTTPS obrigatório)** — o cookie de sessão `__Host-session` só funciona em HTTPS:
   - **sobrescrever** `X-Forwarded-For` com o IP real (`proxy_set_header X-Forwarded-For $remote_addr`) e
     `X-Forwarded-Host` com o host real; enviar `X-Forwarded-Proto` e `Host`;
   - cabeçalhos: `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`,
     `Content-Security-Policy: frame-ancestors 'none'` (não funciona via `<meta>`; a CSP principal vem do
     Astro), `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`,
     `Cross-Origin-Opener-Policy: same-origin`;
   - `limit_req` (sugestão): `/_actions/*` e `/agendar` 10 req/s por IP com burst 20; `/admin/login` 5 req/min;
     `client_max_body_size 32k`.
5. **Manutenção diária (LGPD):** agendar `npm run db:anonymize` (cron) com alerta de falha — anonimiza dados
   pessoais 90 dias após o atendimento e 30 dias após o cancelamento, e apaga os registros de rate limit (hash
   de IP) com mais de 1 hora. A política de privacidade promete esses prazos (hash de IP: até 48 h —
   folga para atraso do cron; configure alerta de falha).
6. **Primeira publicação com esta versão:** sessões admin existentes caem (o cookie passou a se chamar
   `__Host-session`); basta entrar de novo.
7. Portfólio: manter `PUBLIC_NOINDEX=true`. Cliente real: `PUBLIC_NOINDEX=false` + dados reais em `business.ts`.

**Verificação pós-deploy:** `curl -sI https://SEU_DOMINIO/` (cabeçalhos de segurança e CSP); respostas 200 em
`/agendar`, `/privacidade`, `/admin/login`, `/robots.txt`, `/sitemap.xml`; abrir a home no navegador sem erros de
CSP no console.

**Reversão da aplicação:** a app é stateless — reinstale o build anterior e reinicie o Node; restaure a
configuração anterior do proxy; desative o cron se necessário.

## Licenças

Fontes Fraunces e Inter sob SIL Open Font License 1.1 (`public/fonts/LICENSE-OFL.txt`). Ilustrações SVG próprias.
