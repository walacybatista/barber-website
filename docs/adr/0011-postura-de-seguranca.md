# ADR-011 — Postura de segurança: correções, riscos aceitos e responsabilidades do deploy

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** security-auditor, tech-lead, api-engineer

## Contexto
A auditoria pré-release (commit `5d32c1e`) concluiu **APTO COM RESSALVAS**: nenhum achado crítico e nenhuma
vulnerabilidade explorável na configuração padrão; um achado alto dependente do deploy (S1) e médios/baixos.

## Decisão

### Corrigidos no código
| ID | Achado | Correção |
|---|---|---|
| S2 | Erro interno repassava `e.message` (SQL) em Action pública | Mensagem genérica; ids com teto `2^31-1` |
| S2b | Action pública `getBooking` (sem uso) não passava pelo mapeamento de erros | Removida; toda Action com o corpo em try/catch → `toActionError` |
| S3 | `console.error(err)` gravava parâmetros de SQL (PII) em log | Logar só nome/código do erro |
| S5 | Rate limit por IPv6 completo (rotação no /64) | Chave por prefixo /64 |
| S8 | Cancelado com `cancelledAt` nulo nunca anonimizado; texto da política divergente | Referência `createdAt`; política alinhada; cron documentado |
| S9 | Sessão deslizante sem teto | Teto absoluto de 30 dias; cookie `__Host-session` em produção |
| S10 | Corpo até 1 GiB no adaptador | `bodySizeLimit` 64 KB |
| S12 | Mensagem revelava que o telefone tinha 3 agendamentos | Mensagem genérica |

### Riscos aceitos (projeto de portfólio, dados fictícios)
- **S5 (parte):** telefone não é verificado (sem SMS/WhatsApp/CAPTCHA). Num cliente real, exigir confirmação do
  telefone antes de considerar o agendamento confirmado.
- **S6:** 20 erros de senha em 15 min bloqueiam o usuário admin (inclusive o dono). Trade-off documentado no código.
- **S13:** chaves de rate limit são `sha256(ip)` sem sal. Registros com mais de 1 h são apagados pela limpeza
  oportunista e pelo cron diário (`db:anonymize`); a política promete no máximo 48 h (folga para atraso do cron).

### Responsabilidade do deploy (checklist do release-engineer)
- **S1:** `ALLOWED_DOMAIN` é **obrigatório atrás de proxy**: sem ele o Astro ignora `X-Forwarded-For`,
  `clientAddress` vira o IP do proxy e o rate limit por IP colapsa num bucket único (10 agendamentos/h e 20
  logins/15 min para o site inteiro). É lido **no build** (entra no manifest): definir no ambiente do build, não
  só em runtime. Um item por host servido (`cobrevelho.example,www.cobrevelho.example`). O proxy **sobrescreve**
  `X-Forwarded-For` com o IP do TCP (`proxy_set_header X-Forwarded-For $remote_addr`), envia
  `X-Forwarded-Proto` e `Host`; Node exposto só ao proxy.
- **Troca do cookie para `__Host-session`:** no primeiro deploy, todas as sessões admin ativas caem (o cookie
  antigo é ignorado). `__Host-` exige HTTPS em produção; a remoção do cookie precisa repetir `Secure`, senão o
  navegador a ignora (corrigido via `sessionCookieDeleteOptions()`).
- **S4:** cabeçalhos no proxy (valem também para estáticos servidos sem middleware): HSTS, `nosniff`,
  `frame-ancestors 'none'`/`X-Frame-Options: DENY`, `Permissions-Policy`, `COOP`.
- **CSP (implementada):** `security.csp` do Astro 7 — `default-src 'self'`, `script-src`/`style-src` por hash
  (sem `'unsafe-inline'`), `frame-src` só Google Maps, `object-src 'none'`, `base-uri`/`form-action 'self'`.
  Páginas prerenderizadas recebem `<meta>`, páginas SSR o header. O único `<script is:inline>` (BaseLayout) tem
  hash declarado em `astro.config.mjs` — editar esse script exige recalcular o hash (o e2e `csp.spec.ts` falha se
  divergir). Regras: nada de `style="..."` nem `on*=` em componentes. `frame-ancestors` não funciona via
  `<meta>`: fica no proxy.
- **Artefato:** `npm run check:dist` é obrigatório após o build de release (falha se houver credencial em `dist/`,
  achado C1 da varredura complementar: `import.meta.env` dinâmico embutia o env do build no servidor).
- **S7:** `limit_req` no proxy para `/_actions/*`, `/agendar`, `/admin/login`.

## Consequências
- (+) Nenhuma informação interna ou PII sai em respostas ou logs.
- (−) Segurança efetiva em produção depende do proxy configurado conforme o checklist.
