# ADR-003 — Dados fictícios identificados

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead

## Contexto
Projeto de portfólio; não há barbearia real nem dados comerciais.

## Decisão
Usar uma barbearia fictícia. Todo conteúdo comercial fica em um único lugar (`src/data/business.ts` e seed do
banco). O rodapé exibe "Barbearia fictícia — projeto de portfólio". Telefone e endereço usam valores
claramente não reais (ex.: número de WhatsApp configurável por variável de ambiente, com padrão fictício).

## Consequências
- (+) Trocar para um cliente real = editar `business.ts`, o seed e as imagens.
- Risco: confundir visitantes com empresa real — mitigado pelo aviso no rodapé e no README.
- Imagens: fotos livres de direitos com licença registrada em `docs/CREDITS.md`, ou ilustrações próprias.
