# ADR-008 — Cliente gerencia o agendamento por link com token

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead, api-engineer

## Contexto
Cliente precisa cancelar/reagendar sem criar conta (atrito alto para uma barbearia).

## Decisão
Na confirmação, gerar token de 32 bytes (`crypto.randomBytes`, base64url). Exibir o link
`/agendamento/<token>` ao cliente; persistir **somente** `sha256(token)` em `bookings.manage_token_hash`.
A página busca pelo hash. Página com `Cache-Control: no-store` e `<meta name="robots" content="noindex">`.

## Alternativas
- **Conta de cliente:** mais atrito, mais dados pessoais (LGPD).
- **Código por SMS:** custo de provedor; fora do MVP.

## Consequências
- (+) Vazamento do banco não expõe links válidos.
- (−) Perdeu o link = precisa contatar a barbearia (WhatsApp). Aceitável no MVP.
- (−) Link compartilhado dá acesso ao agendamento — mitigado: só expõe primeiro nome e horário.
