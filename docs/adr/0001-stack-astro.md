# ADR-001 — Astro + TypeScript + Tailwind

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead

## Contexto
Site de barbearia: maior parte é conteúdo que muda pouco (serviços, preços, horários), mais um fluxo
dinâmico de agendamento. Prioridades: performance mobile, SEO local, manutenção simples.

## Decisão
Astro com TypeScript strict e Tailwind CSS v4.

## Alternativas
- **Next.js:** pronto para apps dinâmicos, mas envia mais JavaScript ao navegador e adiciona complexidade
  (React Server Components, cache) desnecessária para um site majoritariamente de conteúdo.
- **HTML/CSS puro:** zero dependências, porém sem componentes (duplicação) e sem otimização de imagem.

## Consequências
- (+) Páginas estáticas sem JS por padrão; ótimo Lighthouse e SEO.
- (+) "Ilhas": só os trechos interativos (ex.: seletor de horário) carregam JS.
- (−) Ecossistema de componentes prontos menor que o do React.
- Risco: lock-in baixo — conteúdo e regras de negócio ficam em TS puro (`src/lib`), reaproveitáveis.
