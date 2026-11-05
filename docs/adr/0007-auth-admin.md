# ADR-007 — Autenticação do admin

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead, api-engineer, security-auditor

## Decisão
- Senha com `scrypt` (`node:crypto`), salt aleatório por usuário, comparação com `timingSafeEqual`.
- Sessão: ID aleatório de 32 bytes no cookie `session` (`httpOnly`, `SameSite=Lax`, `secure` em produção,
  `path=/`); no banco fica apenas o hash SHA-256 do ID, com expiração (7 dias, renovação deslizante).
- `src/middleware.ts` carrega a sessão e bloqueia `/admin/**` (exceto `/admin/login`) sem sessão válida.
  Toda Action administrativa verifica sessão de novo no servidor (não confiar só no middleware).
- CSRF: `security.checkOrigin` do Astro ativo.
- Força bruta: limite de 5 tentativas por IP+usuário em 15 min (tabela `login_attempts`).
- Primeiro usuário criado por `npm run admin:create` (CLI). Não há cadastro público.

## Alternativas
- **Lucia/Auth.js/Better Auth:** mais recursos (OAuth, e-mail), mas é dependência adicional para um único
  perfil de usuário. Reavaliar se houver contas de cliente.
- **Basic Auth no servidor:** simples, mas sem logout, sem rate limit e com UX ruim.

## Consequências
- (+) Sem dependência nova; código pequeno e auditável.
- (−) Responsabilidade nossa pela correção — por isso passa obrigatoriamente pelo `security-auditor`.
