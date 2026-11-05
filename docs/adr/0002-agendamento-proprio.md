# ADR-002 — Agendamento próprio já no MVP

- **Data:** 2026-11-05 · **Status:** Aceita (decisão do product owner) · **Agentes:** tech-lead

## Contexto
Foram avaliadas três opções: WhatsApp com mensagem pré-preenchida, link para sistema externo
(Trinks/Booksy) e sistema próprio.

## Decisão
Sistema próprio no MVP, com escopo limitado (ver `docs/SPEC.md` §3.2–3.4).

## Alternativas
- **WhatsApp pré-preenchido:** custo mínimo, nenhum dado pessoal armazenado; não evita conflito.
- **Sistema externo:** robusto, mas tira o diferencial técnico do portfólio e gera dependência de terceiro.

## Consequências
- (+) Demonstra backend, modelagem de dados, concorrência e segurança — valor de portfólio.
- (−) Exige banco, autenticação, painel e obrigações de LGPD.
- Mitigação: lembretes, CRUD de catálogo e indicadores ficam para a v1.1. WhatsApp permanece como canal
  de contato complementar.
