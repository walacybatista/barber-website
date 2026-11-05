# ADR-009 — Site fictício não indexável por padrão

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead, code-reviewer, ui-engineer

## Contexto
A revisão de código apontou que o site publica JSON-LD `BarberShop` com telefone, e-mail e endereço
fictícios, coordenadas de um ponto real de São Paulo (o mapa mostra estabelecimentos reais vizinhos) e um
link de Instagram para uma conta que pode existir ou ser registrada por terceiros. Indexado, isso pode ser
tratado como dado estruturado enganoso e confundir pessoas reais (ADR-003).

## Decisão
- Variável `PUBLIC_NOINDEX` (padrão `true`). Quando ativa: `<meta name="robots" content="noindex, nofollow">`
  em todas as páginas e `robots.txt` com `Disallow: /`.
- Quando `false` (cliente real): `robots.txt` normal com `Disallow: /agendamento/` e `Disallow: /admin`.
- Instagram fictício exibido como texto, sem link clicável.
- Coordenadas do mapa mantidas (mostram a região); risco aceito e documentado aqui.
- Fora do MVP (v1.1): lightbox da galeria e indicador "Aberto agora"/"Hoje" na tabela de horários — desvio
  consciente do `docs/design.md` §6.8 e §6.9.

## Alternativas
- **Remover o JSON-LD:** perde a demonstração de SEO local no portfólio.
- **Omitir só os campos falsos:** JSON-LD incompleto continua sendo de uma empresa inexistente.

## Consequências
- (+) O portfólio é compartilhado por link sem risco de aparecer em buscas como empresa real.
- (+) Virar site de cliente real = `PUBLIC_NOINDEX=false` + dados reais em `business.ts`.
- (−) Lighthouse SEO acusa "page is blocked from indexing" no modo portfólio — esperado; medir SEO com
  `PUBLIC_NOINDEX=false` na Fase 8.
