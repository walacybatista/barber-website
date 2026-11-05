# SPEC — Barber Website (MVP)

> Projeto de portfólio. Todos os dados comerciais (nome, endereço, preços, barbeiros, telefone, fotos) são
> **fictícios** e devem estar marcados como tal no site (rodapé) e no README. Nunca usar dados de empresa real.

## 1. Objetivo do produto

Site de uma barbearia fictícia que apresenta serviços e permite **agendar online** com prevenção real de
conflito de horário, além de um painel administrativo mínimo para o barbeiro/dono gerenciar a agenda.

## 2. Stack (ver ADRs em `docs/adr/`)

- Astro (páginas estáticas + rotas on-demand) · TypeScript strict · Tailwind CSS v4
- Postgres (local: Docker; produção: Supabase ou Neon) · Drizzle ORM + drizzle-kit · driver `postgres`
- Adaptador `@astrojs/node` (standalone) — hospedagem a definir
- Testes: Vitest (unidade/integração) · Playwright (E2E) · Lint: ESLint + Prettier · Tipos: `astro check`

## 3. Escopo do MVP

### 3.1 Site público (estático)
Uma página inicial com seções âncora: Hero + CTA "Agendar", Sobre, Serviços e preços, Barbeiros, Galeria,
Horário de funcionamento, Localização (mapa embutido), Redes sociais, rodapé com aviso "dados fictícios".
Botão flutuante de WhatsApp. Página `/privacidade` (política LGPD).
SEO local: title/description, Open Graph, JSON-LD `BarberShop`, `sitemap.xml`, `robots.txt`.

### 3.2 Agendamento (on-demand)
Fluxo `/agendar`: serviço → barbeiro (ou "sem preferência") → data → horário livre → nome + telefone +
consentimento LGPD → confirmação.
- Horários livres calculados a partir de: horário de funcionamento, duração do serviço, agendamentos
  confirmados e bloqueios do barbeiro. Granularidade de 15 min. Fuso `America/Sao_Paulo`.
- Não permite horário no passado nem além de 30 dias.
- **Duplicidade impedida no banco** (ADR-007), não só na aplicação.
- Confirmação exibe resumo, link de gerenciamento e download `.ics`.
- `/agendamento/[token]`: ver, cancelar ou reagendar (até 2 h antes do horário).

### 3.3 Painel administrativo (`/admin`, on-demand, autenticado)
- Login (usuário criado via script CLI; sem cadastro público). Logout.
- Agenda do dia e da semana por barbeiro.
- Marcar atendimento como concluído / não compareceu; cancelar.
- Criar e remover bloqueios de horário (almoço, folga).
- Serviços, barbeiros e horário de funcionamento vêm de **seed** no MVP.

### 3.4 Fora do MVP (v1.1+)
Lembretes automáticos (e-mail/SMS/WhatsApp API), CRUD de serviços/barbeiros/preços no painel,
indicadores, contas de cliente, pagamentos.

## 4. Regras de negócio

| ID | Regra |
|---|---|
| RN01 | Um barbeiro não pode ter dois períodos ocupados sobrepostos (agendamento confirmado ou bloqueio). |
| RN02 | Agendamento só dentro do horário de funcionamento e com início em múltiplo de 15 min. |
| RN03 | Janela de agendamento: a partir de agora + 30 min até 30 dias à frente. |
| RN04 | Cancelamento/reagendamento pelo cliente até 2 h antes do início. |
| RN05 | Dados coletados: só nome e telefone, com consentimento explícito. |
| RN06 | Dados pessoais anonimizados 90 dias após o atendimento (script de manutenção). |
| RN07 | Token de gerenciamento: 32 bytes aleatórios; só o hash SHA-256 é persistido. |

## 5. Requisitos não funcionais

- Mobile-first; testado em 360, 768 e 1280 px.
- Lighthouse mobile ≥ 90 em Performance, Acessibilidade, Boas práticas e SEO (página inicial).
- WCAG 2.1 AA: contraste, foco visível, navegação por teclado, labels em formulários.
- Imagens via `astro:assets` (formatos modernos, `width/height`, lazy loading).
- Segredos só em variáveis de ambiente; `.env` fora do Git; `.env.example` documentado.
- Sessão admin: cookie `httpOnly`, `secure` em produção, `SameSite=Lax`; senha com `scrypt`;
  limite de tentativas de login; checagem de origem (CSRF) ativa.

## 6. Critérios de aceite por fase

| Fase | Critério |
|---|---|
| 3 UX/UI | `docs/design.md` aprovado (paleta, tipografia, componentes, wireframe das seções); contraste AA. |
| 4 Arquitetura | ADRs 001–008 registrados; schema do banco definido. |
| 5 Estrutura | `npm run build`, `npm run check`, `npm run lint`, `npm test` passam; Postgres sobe via `docker compose up -d`; migração inicial aplica. |
| 6 Funcionalidades | Site público completo a partir de dados seed; fluxo de agendamento e painel funcionando; RN01–RN07 com testes. |
| 7 Integrações | Mapa, JSON-LD, sitemap, `.ics`, WhatsApp; build com adaptador Node rodando em `node dist/server/entry.mjs`. |
| 8 Qualidade | Vitest + Playwright verdes (fluxo agendar → cancelar; login admin; conflito de horário); Lighthouse e a11y conforme §5. |
| 9 Revisão | `code-reviewer` e `security-auditor` sem achados críticos/altos abertos. |
| 10 Release | README de execução e manutenção; checklist do `release-engineer` aprovado. |
