# Design — Cobre Velho Barbearia (FICTÍCIA)

> Projeto de portfólio. Nome, endereço, telefone, preços, barbeiros, fotos e avaliações são **inventados**
> e devem aparecer marcados como fictícios (rodapé, README, `/privacidade`). Este documento é a fonte visual
> e de UX para as Fases 5-6. Status: **proposta, aguardando aprovação** (SPEC §6, Fase 3).

## 1. Conceito e personalidade

**Nome:** *Cobre Velho Barbearia* (marca inventada; slogan fictício: "Corte clássico, hora marcada.").
Não foi encontrada associação intencional com marca conhecida, mas **não houve busca em registro (INPI)
nem de domínio**; vale uma checagem rápida antes de qualquer uso fora do portfólio.

**Direção visual:** *barbearia clássica moderna*. Fundo escuro quente (carvão amarronzado), acento em cobre
(a cor do metal de tesoura e navalha antiga), títulos em serifa de alto contraste com ar de cartaz de
barbearia, corpo em sans neutra e legível. Linhas finas, cantos pouco arredondados, fotos em tom quente.

**Por que funciona:**
- Cobre sobre carvão dá identidade própria e evita o clichê preto/dourado, sem perder o ar premium.
- Tema escuro é padrão (um só tema no MVP): combina com o universo noturno/masculino da barbearia, valoriza
  fotos de corte e reduz esforço de design. Todos os contrastes foram calculados para AA (seção 2).
- Serifa nos títulos + sans no corpo une tradição (ofício) e clareza (formulário de agendamento rápido).
- Poucas cores = CSS leve e UI previsível; estados usam cor **e** ícone/texto, nunca só cor.

## 2. Paleta (design tokens)

Contraste = razão WCAG 2.1 calculada com luminância relativa sRGB (script Node, 2 casas). Limiares:
texto normal 4,5:1; texto grande (>=24px, ou >=18,66px bold) e componentes de UI 3:1.

### 2.1 Tokens

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#14110F` | Fundo da página |
| `surface` | `#1E1A17` | Cards, header, formulários |
| `surface-2` | `#2A2420` | Cards em destaque, hover de linha, campos sobre surface |
| `border-subtle` | `#3A322C` | Divisórias **decorativas** (não comunicam estado) |
| `border-strong` | `#8A7C6E` | Borda de input, radio card, slot, botão secundário |
| `text` | `#F3ECE2` | Texto principal, títulos |
| `text-muted` | `#B8AB9B` | Texto secundário, legendas, placeholders |
| `primary` | `#D08A4A` | Acento cobre: botão primário, links, destaques, slot selecionado |
| `primary-hover` | `#E0A065` | Hover/pressed do primário |
| `on-primary` | `#14110F` | Texto/ícone sobre `primary` |
| `success` | `#6FCB8E` | Confirmação |
| `success-bg` | `#16301F` | Fundo de alerta de sucesso |
| `error` | `#FF8F86` | Erro, validação |
| `error-bg` | `#3A1D1B` | Fundo de alerta de erro |
| `warning` | `#EBB54F` | Aviso |
| `warning-bg` | `#3A2D12` | Fundo de alerta de aviso |
| `focus` | `#7CC4FF` | Anel de foco (azul frio contrasta com a paleta quente) |
| `disabled` | `#8A7E72` | Texto/ícone desabilitado (isento de WCAG; ver nota) |
| `whatsapp` | `#25D366` | Somente o botão flutuante (cor reconhecível) |

### 2.2 Contrastes calculados

| Texto/elemento | Fundo | Razão | AA |
|---|---|---|---|
| `text` | `bg` | 16,03:1 | Passa |
| `text` | `surface` | 14,73:1 | Passa |
| `text` | `surface-2` | 13,06:1 | Passa |
| `text-muted` | `bg` | 8,36:1 | Passa |
| `text-muted` | `surface` | 7,68:1 | Passa |
| `text-muted` | `surface-2` | 6,81:1 | Passa |
| `primary` (link/texto) | `bg` | 6,64:1 | Passa |
| `primary` | `surface` | 6,10:1 | Passa |
| `primary` | `surface-2` | 5,41:1 | Passa |
| `primary-hover` | `bg` | 8,40:1 | Passa |
| `on-primary` | `primary` | 6,64:1 | Passa |
| `on-primary` | `primary-hover` | 8,40:1 | Passa |
| `border-strong` (UI) | `bg` | 4,65:1 | Passa (3:1) |
| `border-strong` (UI) | `surface` | 4,27:1 | Passa (3:1) |
| `border-strong` (UI) | `surface-2` | 3,78:1 | Passa (3:1) |
| `focus` (UI) | `bg` | 10,03:1 | Passa (3:1) |
| `focus` (UI) | `surface` | 9,21:1 | Passa (3:1) |
| `focus` (UI) | `surface-2` | 8,16:1 | Passa (3:1) |
| `success` | `bg` | 9,50:1 | Passa |
| `success` | `surface` | 8,73:1 | Passa |
| `success` | `success-bg` | 7,18:1 | Passa |
| `error` | `bg` | 8,53:1 | Passa |
| `error` | `surface` | 7,84:1 | Passa |
| `error` | `error-bg` | 6,95:1 | Passa |
| `warning` | `bg` | 10,08:1 | Passa |
| `warning` | `surface` | 9,26:1 | Passa |
| `warning` | `warning-bg` | 7,20:1 | Passa |
| `text` | `success-bg` | 12,13:1 | Passa |
| `text` | `error-bg` | 13,06:1 | Passa |
| `text` | `warning-bg` | 11,45:1 | Passa |
| `on-primary` (`#14110F`) | `whatsapp` | 9,48:1 | Passa |
| `disabled` | `bg` | 4,75:1 | Passa (isento) |
| `disabled` | `surface` | 4,37:1 | Isento (componente inativo) |
| `disabled` | `surface-2` | 3,87:1 | Isento (componente inativo) |
| `border-subtle` | `bg` / `surface` | 1,50:1 / 1,38:1 | **Não usar** para limite de controle; só decoração |

**Regras derivadas dos números:**
- **Proibido** `text` (claro) sobre `primary`: 2,41:1, reprova. Sobre cobre use sempre `on-primary`.
- `focus` sobre `primary` dá apenas 1,51:1. Por isso o anel de foco usa `outline-offset: 2px`, ficando
  sobre o fundo da página/card (10,03:1) e não sobre o botão cobre.
- `border-subtle` não atinge 3:1: nunca é a única indicação de um campo ou botão.
- Estado nunca só por cor: erro = ícone + texto; slot indisponível = riscado + texto para leitor de tela.
- Elementos desabilitados são isentos de contraste pela WCAG, mas mantêm legibilidade (>= 3,87:1).

## 3. Tipografia

Duas famílias, ambas do Google Fonts, **auto-hospedadas** (sem requisição a terceiros, melhor LGPD e
performance): baixar WOFF2 variável subset `latin` + `latin-ext` para `public/fonts/` no momento da
implementação (não feito aqui).

| Papel | Família | Pesos | Uso |
|---|---|---|---|
| Display | **Fraunces** (variável) | 600, 700 | Títulos h1-h3, preços em destaque |
| Texto | **Inter** (variável) | 400, 500, 600 | Corpo, UI, formulários |

- `font-display: swap`; `<link rel="preload">` apenas para Inter 400-600 e Fraunces 600-700 (2 arquivos).
- Fallbacks: Display `Georgia, "Times New Roman", serif`; Texto `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Corpo mínimo 16px (evita zoom automático em inputs no iOS).

### Escala

| Token | Mobile | Desktop (>= lg) | Peso | Line-height | Uso |
|---|---|---|---|---|---|
| `text-display` | 2.5rem (40) | 4rem (64) | Display 700 | 1,05 | h1 do hero |
| `text-h1` | 2rem (32) | 2.75rem (44) | Display 700 | 1,15 | h1 de páginas internas |
| `text-h2` | 1.75rem (28) | 2.25rem (36) | Display 600 | 1,2 | Título de seção |
| `text-h3` | 1.25rem (20) | 1.5rem (24) | Display 600 | 1,3 | Cards |
| `text-lg` | 1.125rem (18) | 1.25rem (20) | Inter 400 | 1,6 | Lead/intro |
| `text-base` | 1rem (16) | 1rem (16) | Inter 400 | 1,6 | Corpo |
| `text-sm` | 0.875rem (14) | 0.875rem (14) | Inter 400/500 | 1,5 | Legendas, ajuda, erro |
| `text-xs` | 0.75rem (12) | 0.75rem (12) | Inter 500, caixa-alta, tracking 0.08em | 1,4 | Eyebrow, selo "fictício" |

Tamanho `display` e `h1` >= 24px contam como texto grande; ainda assim todos os pares já passam em 4,5:1.
Medida de leitura máx. `65ch` em parágrafos.

## 4. Espaçamento, raio, sombras, breakpoints

- **Espaço:** base 4px (escala do Tailwind). Gutter lateral: 16px base, 24px `md`, 32px `lg`.
  Container máx. 1120px (`max-w-[70rem]`). Seção: padding vertical 64px base, 96px `lg`.
  Gap entre campos de formulário 16px; entre grupo de cards 16px base, 24px `lg`.
- **Raio:** `sm` 4px (chips, slots), `md` 8px (botões, inputs, cards), `lg` 12px (modais/alerts), `full`
  (avatar, botão WhatsApp). Cantos discretos mantêm o ar de ofício.
- **Sombras (tema escuro: pouca sombra, mais borda):** `shadow-card` `0 1px 0 rgb(255 255 255 / .04) inset,
  0 8px 24px rgb(0 0 0 / .35)`; `shadow-pop` (menu, toast) `0 12px 32px rgb(0 0 0 / .5)`.
- **Breakpoints (mobile-first):** base (0-639), `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Testes obrigatórios
  em 360, 768 e 1280 (SPEC §5).
- **Movimento:** 150ms (hover/foco), 250ms (abrir menu), easing `cubic-bezier(.2,.7,.2,1)`. Tudo reduzido a
  ~0 sob `prefers-reduced-motion` (seção 8).

## 5. Bloco `@theme` (Tailwind v4)

Colar em `src/styles/global.css` após `@import "tailwindcss";`. Gera utilitários como `bg-bg`,
`bg-surface`, `text-text-muted`, `bg-primary`, `text-on-primary`, `border-border-strong`, `font-display`,
`rounded-md`, `shadow-card`.

```css
@import "tailwindcss";

@theme {
  /* Cores */
  --color-bg: #14110f;
  --color-surface: #1e1a17;
  --color-surface-2: #2a2420;
  --color-border-subtle: #3a322c;
  --color-border-strong: #8a7c6e;
  --color-text: #f3ece2;
  --color-text-muted: #b8ab9b;
  --color-primary: #d08a4a;
  --color-primary-hover: #e0a065;
  --color-on-primary: #14110f;
  --color-success: #6fcb8e;
  --color-success-bg: #16301f;
  --color-error: #ff8f86;
  --color-error-bg: #3a1d1b;
  --color-warning: #ebb54f;
  --color-warning-bg: #3a2d12;
  --color-focus: #7cc4ff;
  --color-disabled: #8a7e72;
  --color-whatsapp: #25d366;

  /* Fontes */
  --font-display: "Fraunces Variable", Georgia, "Times New Roman", serif;
  --font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Escala tipográfica (mobile; desktop sobrescreve via @media abaixo) */
  --text-xs: 0.75rem;
  --text-xs--line-height: 1.4;
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.5;
  --text-base: 1rem;
  --text-base--line-height: 1.6;
  --text-lg: 1.125rem;
  --text-lg--line-height: 1.6;
  --text-h3: 1.25rem;
  --text-h3--line-height: 1.3;
  --text-h2: 1.75rem;
  --text-h2--line-height: 1.2;
  --text-h1: 2rem;
  --text-h1--line-height: 1.15;
  --text-display: 2.5rem;
  --text-display--line-height: 1.05;

  /* Raio */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  /* Sombras */
  --shadow-card: 0 1px 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px rgb(0 0 0 / 0.35);
  --shadow-pop: 0 12px 32px rgb(0 0 0 / 0.5);

  /* Breakpoints */
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;

  /* Movimento */
  --ease-out-soft: cubic-bezier(0.2, 0.7, 0.2, 1);
}

/* Escala desktop */
@media (min-width: 64rem) {
  :root {
    --text-lg: 1.25rem;
    --text-h3: 1.5rem;
    --text-h2: 2.25rem;
    --text-h1: 2.75rem;
    --text-display: 4rem;
  }
}
/* Nota de implementação: se utilitários não refletirem a troca em lg, trocar para
   @theme inline + variáveis em :root; decidir na Fase 5. */

@layer base {
  html { color-scheme: dark; scroll-behavior: smooth; scroll-padding-top: 5rem; }
  body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); }
  :focus-visible {
    outline: 3px solid var(--color-focus);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

## 6. Inventário de componentes

Convenções: alvo mínimo **44x44px**; foco = anel `focus` 3px com offset 2px (global, nunca removido);
hover só em `@media (hover: hover)`; desabilitado = `disabled` + `aria-disabled`, sem hover; carregando =
`aria-busy="true"` + spinner/skeleton, controle inerte; erro = ícone + texto + `aria-invalid`.

### 6.1 Button
Variantes (altura 44px base, 48px `md+`; padding-x 20px; raio `md`; peso 600; ícone opcional 20px):

| Estado | Primário | Secundário | Ghost |
|---|---|---|---|
| Padrão | fundo `primary`, texto `on-primary` | fundo transparente, borda 1px `border-strong`, texto `text` | sem borda, texto `primary` |
| Hover | fundo `primary-hover` | fundo `surface-2` | fundo `surface-2` |
| Foco | anel `focus` | idem | idem |
| Pressionado | `primary` escurecido 8% | `surface` | `surface` |
| Desabilitado | fundo `surface-2`, texto `disabled`, sem sombra | borda `border-subtle`, texto `disabled` | texto `disabled` |
| Carregando | texto mantido + spinner 16px à esquerda, `aria-busy`, largura estável | idem | idem |
| Erro | n/a (erro aparece em Alert/campo; botão volta ao padrão e mantém rótulo) | | |

Usar `<button>` para ações e `<a>` estilizado para navegação. Largura total em mobile em formulários.

### 6.2 Link
Texto `primary`, sublinhado 1px com offset 3px (sublinhado sempre visível em texto corrido, para não
depender só de cor). Hover: `primary-hover` e sublinhado 2px. Foco: anel. Link externo: ícone + "(abre em
nova aba)" em `sr-only` + `rel="noopener noreferrer"`. Desabilitado: não se usa (remover o link ou virar texto).

### 6.3 Header e navegação mobile
- Landmark `<header>` com `<nav aria-label="Principal">`. Altura 64px, `surface` com borda inferior
  `border-subtle`, sticky; logo (texto Display "Cobre Velho") à esquerda; CTA "Agendar" sempre visível.
- **Desktop (>= md):** links âncora em linha (Sobre, Serviços, Barbeiros, Galeria, Horários, Contato) + botão
  primário. Link da seção ativa com `aria-current="true"` e sublinhado cobre.
- **Mobile (< md):** botão "Menu" 44x44 (`<button aria-expanded aria-controls="menu-principal">`, ícone
  hambúrguer com rótulo acessível fixo "Menu"; o estado é comunicado só por `aria-expanded`, para o leitor de tela não anunciar em duplicidade — revisão de código 2026-11-05). Painel em tela cheia sob o header:
  lista vertical, itens com 48px de altura. Comportamento acessível: abre -> foco vai ao primeiro item;
  `Esc` fecha e devolve foco ao botão; `Tab` não escapa do painel enquanto aberto (foco contido, fundo
  `inert`); fechar ao selecionar item âncora; rolagem do body travada. Sem JS: nav visível como lista
  (progressive enhancement via `<details>` ou lista aberta). Skip link "Ir para o conteúdo" é o primeiro
  foco da página.
- Estados do item: padrão `text`; hover `primary`; foco anel; ativo `aria-current`.
- Em `/agendar` e `/admin` o header é simplificado (logo + "Voltar ao site"/"Sair").

### 6.4 Footer
Landmark `<footer>`, fundo `surface`. Colunas (desktop) / pilha (mobile): marca + slogan fictício; contato
(endereço e telefone **fictícios**); redes sociais (ícones 44x44 com `aria-label`); links `/privacidade` e
"Agendar". Faixa inferior, texto `text-muted` `text-sm`:
**"Barbearia fictícia — projeto de portfólio. Nome, endereço, telefone, preços e fotos são inventados."**
Mais "© 2026 Cobre Velho (fictícia)". O aviso é texto real, não imagem, e nunca só em tooltip.

### 6.5 SectionHeading
Eyebrow `text-xs` caixa-alta `primary` (ex.: "SERVIÇOS") + `h2` Display + subtítulo opcional `text-muted`
(máx. 65ch) + filete cobre de 48x2px. Cada seção usa `<section aria-labelledby="id-do-h2">`. Hierarquia:
um único `h1` (hero); seções `h2`; cards `h3`. Sem estados interativos.

### 6.6 ServiceCard
`<article>` em `surface`, borda `border-subtle`, raio `md`, padding 20px. Conteúdo: nome (`h3`), descrição
curta (`text-muted`), linha com duração ("30 min", ícone relógio) e preço (Display 600, `primary`;
"R$ 45,00" fictício). Opcional CTA "Agendar este serviço" (link para `/agendar?servico=slug`).
Estados: padrão; hover (borda `border-strong`, elevação sutil) se for clicável; foco no link interno;
carregando = Skeleton; vazio = EmptyState "Serviços em atualização"; erro n/a (dados de seed estático).
Grid: 1 col base, 2 `md`, 3 `lg`. O preço usa `<data>`/texto com "R$"; leitor lê "45 reais".

### 6.7 BarberCard
Foto 4:5 (`object-cover`, raio `md`), nome (`h3`), especialidade, bio de 1 linha, lista de dias (opcional).
Texto alternativo da foto: "Retrato de [nome], barbeiro fictício" (retratos são ilustrativos/banco livre).
Estados: padrão; hover (leve zoom 1.02 da foto, desligado em reduced-motion); foco se houver link
"Agendar com [nome]". Grid 1 col base, 2 `sm`, 3-4 `lg`. Carregando: Skeleton 4:5.

### 6.8 GalleryGrid
Grade `grid-cols-2` base, 3 `md`, 4 `lg`; células quadradas 1:1 (miniatura) com `gap-2`; `<ul>` de `<figure>`.
Clique/Enter abre ampliação em `<dialog>` (foco preso, `Esc` fecha, setas navegam, botão fechar 44x44,
contador "3 de 8"). Sem JS: miniatura linka para a imagem em tamanho cheio. Cada imagem com `alt`
descritivo (seção 8). Estados: padrão, hover (overlay leve + ícone ampliar), foco anel, carregando (Skeleton
quadrado), erro de imagem (fundo `surface-2` + ícone + alt visível), vazio (EmptyState).

### 6.9 HoursTable
`<table>` com `<caption class="sr-only">Horário de funcionamento</caption>`, `<th scope="row">` por dia e
colunas "Abre/Fecha" (ou célula única "09:00 - 19:00"). "Hoje" destacado: linha `surface-2` + selo "Hoje"
(texto, não só cor) + `aria-current="date"`. Dia fechado: "Fechado" em `text-muted`. Selo ao vivo "Aberto
agora"/"Fechado agora" (`success`/`text-muted` + ícone + texto), calculado no cliente com fuso
`America/Sao_Paulo`; sem JS mostra apenas a tabela. Horários exibidos são **fictícios**.

### 6.10 MapEmbed
`<iframe title="Mapa da localização da Cobre Velho Barbearia (endereço fictício)" loading="lazy"
referrerpolicy="no-referrer-when-downgrade">`, proporção 16:9 mobile / 21:9 desktop, borda `border-subtle`,
raio `md`. **Facade:** antes de carregar, mostra card `surface-2` com endereço fictício e botão "Carregar
mapa" (evita requisição a terceiros e ganha em Lighthouse/LGPD); após clique, carrega o iframe. Fallback
sempre visível: link "Abrir no Google Maps" e endereço em texto. Erro/indisponível: mostrar só o fallback.

### 6.11 WhatsAppFloatingButton
`<a>` fixo canto inferior direito (16px das bordas, respeitando `env(safe-area-inset-bottom)`), círculo 56px
`whatsapp`, ícone `on-primary` (`#14110F`, 9,48:1), `aria-label="Falar no WhatsApp (abre em nova aba)"`,
`z-index` abaixo de menu/dialog. Hover: leve elevação; foco: anel `focus` com offset. Não cobrir CTA nem o
rodapé: ganha `bottom` extra quando o footer entra na viewport ou na `/agendar` (ocultar em passos de
formulário para não sobrepor o botão "Continuar"). Número fictício; link `https://wa.me/55XXXXXXXXXXX`
(placeholder inventado; texto pré-preenchido "Olá! Quero saber mais (projeto fictício)").

### 6.12 Formulários

Estrutura comum: `<label>` visível acima do campo (nunca só placeholder), texto de ajuda `text-sm`
`text-muted` ligado por `aria-describedby`, mensagem de erro logo abaixo ligada ao mesmo `aria-describedby`.
Campo: altura 48px, fundo `surface`, borda 1px `border-strong`, raio `md`, texto `text`, placeholder
`text-muted`.

**Mensagem de erro:** `<p id="nome-erro" class="text-error text-sm">` com ícone "!" (ícone decorativo
`aria-hidden`) + texto. Campo recebe `aria-invalid="true"` e `aria-describedby="nome-ajuda nome-erro"`. Ao
enviar com erro: resumo no topo (`role="alert"`, "Corrija 2 campos para continuar" + links para campos) e
foco movido ao resumo.

**Input** (texto, tel):

| Estado | Visual |
|---|---|
| Padrão | borda `border-strong` |
| Hover | borda `text-muted` |
| Foco | anel `focus` 3px (borda vira `focus`) |
| Desabilitado | fundo `surface-2`, texto `disabled`, cursor not-allowed |
| Carregando | spinner no fim do campo, `aria-busy` (ex.: validação de telefone) |
| Erro | borda 2px `error`, ícone + mensagem em `error` |

Telefone: `type="tel" inputmode="tel" autocomplete="tel"`, máscara `(11) 91234-5678` aplicada sem quebrar
leitor de tela. Nome: `autocomplete="name"`.

**Select:** mesmo visual do Input, seta cobre (`<select>` nativo, estilizado com `appearance` próprio para
manter teclado e leitores de tela). Mesmos estados.

**Radio cards** (serviço e barbeiro): `<fieldset><legend>`; cada opção é `<label>` com `<input type="radio">`
nativo visualmente oculto mas focável (`sr-only`), cartão 100% clicável, mín. 64px de altura.

| Estado | Visual |
|---|---|
| Padrão | `surface`, borda `border-strong`, indicador circular vazio |
| Hover | `surface-2` |
| Foco (teclado) | anel `focus` no cartão (via `:has(:focus-visible)`) |
| Selecionado | borda 2px `primary`, indicador preenchido + ícone check (não só cor), fundo `surface-2` |
| Desabilitado | `disabled`, sem hover; motivo em texto ("Indisponível neste dia") |
| Carregando | Skeleton do cartão |
| Erro | `fieldset` com mensagem "Escolha um serviço" em `error` e borda `error` |

Setas navegam entre opções (comportamento nativo do radio group).

**Checkbox de consentimento (LGPD, RN05):** caixa 24px (área clicável 44px incluindo o texto), rótulo: "Li e
concordo com o uso do meu nome e telefone para este agendamento, conforme a [Política de Privacidade]
(abre em nova aba)." Obrigatório, **nunca pré-marcado**. Erro: "Para agendar, precisamos do seu
consentimento." Estados iguais ao Input; marcado = fundo `primary` + check `on-primary`.

### 6.13 DatePicker simples
Sem biblioteca. Faixa horizontal rolável de **30 dias** (RN03) em `<fieldset><legend>Escolha a data</legend>`
com radio cards compactos: dia da semana abreviado ("qui"), número ("14"), mês ("nov"); 64x72px. Selecionado:
borda e fundo `primary`/`on-primary`. Dia sem horário ou fechado: desabilitado com `title`/texto sr-only
"sem horários". Navegação por teclado (setas) e botões "anterior/próximos 7 dias" 44x44. Alternativa em
`>= md`: grade mensal opcional; MVP fica com a faixa (mais simples e acessível). Também oferecer
`<input type="date">` nativo como fallback sem JS (com `min`/`max`). Fuso: datas no fuso `America/Sao_Paulo`.

### 6.14 TimeSlotGrid
`role="radiogroup"` com `aria-label="Horários disponíveis em [data por extenso]"`. Grade 3 col base, 4 `sm`,
6 `lg`; slot = botão 44x44 mín (48 altura), "09:15", raio `sm`. Granularidade 15 min (muitos slots): agrupar
por período ("Manhã", "Tarde", "Noite") com `h3`; "Mostrar mais" se > 24 por período.

| Estado | Visual | Semântica |
|---|---|---|
| Livre | `surface`, borda `border-strong`, texto `text` | radio habilitado |
| Hover | `surface-2` | |
| Foco | anel `focus` | |
| Selecionado | fundo `primary`, texto `on-primary`, ícone check | `aria-checked="true"` |
| Indisponível | fundo `surface-2`, texto `disabled`, **riscado**, sem hover | `disabled` + sr-only "indisponível" |
| Carregando | 12 Skeletons | `aria-busy` na região |
| Erro | veja Alert abaixo | `role="alert"` |

Legenda visível sob a grade: [livre] Livre, [selecionado] Selecionado, [riscado] Indisponível.
Região com `aria-live="polite"` anuncia "8 horários disponíveis" ao trocar de data.

### 6.15 Stepper do agendamento
`<nav aria-label="Etapas do agendamento"><ol>`: 1 Serviço, 2 Barbeiro, 3 Data e hora, 4 Seus dados, 5
Confirmação (a 5 é o resultado). Cada item: círculo 32px + rótulo; atual `aria-current="step"` (círculo
`primary`, rótulo `text`), concluído (check, navegável de volta, link/botão 44px), futuro (`border-strong`,
`text-muted`, não clicável). Mobile: compacto "Etapa 3 de 4 — Data e hora" + barra de progresso 4px
(`<progress>` ou `role="progressbar"` com valores), sem rótulos de todas as etapas. Desktop: linha com rótulos.
Ao trocar de etapa: foco vai ao `h2` da etapa (`tabindex="-1"`), título da página atualizado e anunciado.
Resumo parcial (serviço, barbeiro, data) fixo em coluna lateral (`lg`) ou colapsável (mobile).

### 6.16 Alert e Toast
- **Alert** (inline, persistente): ícone + título + texto + ação opcional. Variantes `success`, `error`,
  `warning`, `info` (`info` usa `surface-2` + borda `focus`). Fundo `*-bg`, borda 1px da cor, texto `text`,
  ícone/título na cor do estado (todos >= 6,95:1). `role="alert"` para erro e `role="status"` para sucesso/aviso.
  Raio `lg`. Fechável só quando não bloqueante (botão 44x44 "Fechar aviso").
- **Toast** (feedback leve, ex.: "Bloqueio criado"): canto inferior (mobile: acima do botão WhatsApp),
  `role="status"`, 6s mínimo e **pausa em hover/foco**; nunca para erro que exige ação (usar Alert).
  Máx. 1 visível. Em reduced-motion aparece sem deslizar.

### 6.17 EmptyState
Ícone 48px `text-muted` + título (`h3`) + texto de 1-2 linhas + ação opcional (Button secundário). Sem
ilustração pesada. Exemplos na seção 9. `role="status"` quando o vazio surge depois de uma ação do usuário.

### 6.18 Skeleton
Bloco `surface-2` com brilho em gradiente (shimmer 1,4s). Sob reduced-motion: estático, sem shimmer.
`aria-hidden="true"` no bloco e `aria-busy="true"` + texto sr-only "Carregando..." no contêiner. Mesmas
dimensões do conteúdo final (evita CLS). Variantes: texto (3 linhas), card, slot (96x48), foto 4:5/1:1.

## 7. Wireframes

Legenda: `[ Botão ]` ação; `( ) / (o)` radio; `[ ] / [x]` checkbox; `[ 09:00 ]` slot livre; `[09:15]*`
selecionado; `[x09:30x]` indisponível (riscado); `###` imagem; `...` conteúdo omitido. Tudo fictício.

### 7.1 Página inicial (ordem fixa das seções)

Ordem: Header, Hero, Sobre, Serviços, Barbeiros, Galeria, Horários, Localização, Redes sociais, Footer
(+ botão WhatsApp flutuante em todas).

**Mobile (360px)**
```
+--------------------------------+
| [skip link: Ir para o conteúdo]|
| COBRE VELHO          [≡ Menu]  |  header sticky 64px
+--------------------------------+
| ################################|
| ##### foto hero (16:10) ########|  h1 sobre a foto com overlay
| CORTE CLÁSSICO,                |
| HORA MARCADA.                  |
| Barbearia fictícia em São...   |
| [   Agendar horário   ]        |  primário, largura total
| [ Ver serviços ]               |  secundário
+--------------------------------+
| SOBRE                          |
| Tradição no corte, ...         |  h2 + 2 parágrafos + 3 números
| (3 destaques: 12 anos*, ...)   |  * dados fictícios
+--------------------------------+
| SERVIÇOS E PREÇOS              |
| +----------------------------+ |
| | Corte clássico   30 min    | |
| | R$ 45,00        [Agendar]  | |
| +----------------------------+ |
| | Barba na navalha 30 min .. | |
| | ... (empilhados)           | |
+--------------------------------+
| BARBEIROS                      |
| +----------+  (1 col; carrossel |
| | ### 4:5  |   NÃO usado)       |
| | Nome     |                   |
| +----------+                   |
+--------------------------------+
| GALERIA                        |
| [###][###]   grade 2 col       |
| [###][###]                     |
+--------------------------------+
| HORÁRIO DE FUNCIONAMENTO       |
| ● Aberto agora                 |
| Seg-Sex  09:00 - 19:00         |
| Sáb      09:00 - 17:00         |
| Dom      Fechado               |
+--------------------------------+
| LOCALIZAÇÃO                    |
| Rua Inventada, 123 - Cidade*   |
| [ Carregar mapa ]  (facade)    |
| Abrir no Google Maps           |
+--------------------------------+
| REDES SOCIAIS  [ig][fb][wa]    |
+--------------------------------+
| FOOTER: marca · contato        |
| Privacidade · Agendar          |
| Barbearia fictícia — projeto   |
| de portfólio.                  |
+--------------------------------+
                         (WA) 56px  <- flutuante
```

**Desktop (1280px)**
```
+------------------------------------------------------------------+
| COBRE VELHO   Sobre Serviços Barbeiros Galeria Horários Contato [Agendar] |
+------------------------------------------------------------------+
| #################### HERO (full-bleed, 70vh) ################### |
| CORTE CLÁSSICO,                         |                        |
| HORA MARCADA.                           |   ### foto 4:5 ###     |
| texto lead                              |                        |
| [ Agendar horário ] [ Ver serviços ]    |                        |
+------------------------------------------------------------------+
| SOBRE        | texto (60ch)            | ### foto 1:1 ###        |
+------------------------------------------------------------------+
| SERVIÇOS E PREÇOS                                                 |
| [ card ] [ card ] [ card ]   (3 col, linhas conforme o seed)      |
+------------------------------------------------------------------+
| BARBEIROS    [ 4:5 ] [ 4:5 ] [ 4:5 ]                              |
+------------------------------------------------------------------+
| GALERIA      [#][#][#][#]                                          |
|              [#][#][#][#]                                          |
+------------------------------------------------------------------+
| HORÁRIOS (tabela, 5/12)         | LOCALIZAÇÃO: mapa 7/12           |
+------------------------------------------------------------------+
| REDES SOCIAIS                                                      |
+------------------------------------------------------------------+
| FOOTER 4 colunas + faixa "Barbearia fictícia — projeto de portfólio" |
+------------------------------------------------------------------+
```

### 7.2 Fluxo `/agendar`

Layout geral: mobile = uma coluna com Stepper compacto e barra fixa inferior com ação; desktop (>= lg) =
formulário 8/12 + resumo 4/12.

**Passo 1 — Serviço (mobile)**
```
+--------------------------------+
| COBRE VELHO     [Voltar ao site]|
| Etapa 1 de 4 - Serviço         |
| [=====-----------------]       |
| h2: Escolha o serviço          |
| (o) Corte clássico             |
|     30 min · R$ 45,00          |
| ( ) Barba na navalha           |
|     30 min · R$ 35,00          |
| ( ) Corte + barba              |
|     60 min · R$ 70,00          |
| Valores fictícios              |
+--------------------------------+
| [        Continuar        ]    |  barra fixa; desabilitada até escolher
+--------------------------------+
```

**Passo 2 — Barbeiro**
```
| Etapa 2 de 4 - Barbeiro        |
| h2: Com quem você quer cortar? |
| (o) Sem preferência            |
|     Primeiro horário livre     |
| ( ) [foto] Nome A              |
| ( ) [foto] Nome B              |
| [ Voltar ]      [ Continuar ]  |
```

**Passo 3 — Data e horário (estado normal)**
```
| Etapa 3 de 4 - Data e horário  |
| h2: Escolha data e horário     |
| Data                           |
| <  [qui14][sex15][sáb16]...  > |  30 dias; dias cheios desabilitados
| Horários em qui, 14 de nov     |
| Manhã                          |
| [09:00][09:15*][09:30]         |
| [x09:45x][10:00][10:15]        |
| Tarde ...                      |
| Legenda: livre/selec./indisp.  |
| [ Voltar ]      [ Continuar ]  |
```

**Passo 3 — Estado vazio ("sem horários neste dia")**
```
| Horários em seg, 18 de nov     |
| +----------------------------+ |
| |  (relógio)                 | |  role="status"
| |  Sem horários neste dia    | |
| |  Todos os horários de      | |
| |  seg, 18 foram preenchidos | |
| |  ou a barbearia está       | |
| |  fechada.                  | |
| |  [ Ver próximo dia livre ] | |  seleciona o 1º dia com vagas
| |  [ Trocar de barbeiro ]    | |
| +----------------------------+ |
| [ Continuar ] desabilitado     |
```

**Passo 3 — Carregando**: 12 Skeletons de slot + texto sr-only "Carregando horários...".

**Passo 4 — Seus dados**
```
| Etapa 4 de 4 - Seus dados      |
| Resumo: Corte clássico · Nome A|
|         qui, 14 nov · 09:15    |
|         [Alterar]              |
| Nome completo *                |
| [______________________]       |
| Telefone (WhatsApp) *          |
| [(11) _____-____]              |
|  ajuda: usamos só para...      |
| [ ] Li e concordo com a        |
|     Política de Privacidade *  |
| [ Voltar ] [ Confirmar agend.] |
```
Com erros de validação:
```
| (!) Corrija 2 campos para continuar |  role="alert"
|   - Informe seu nome                |
|   - Aceite o consentimento          |
| Nome completo *                |
| [______________] borda vermelha|
| (!) Informe seu nome.          |
```

**Erro — "horário acabou de ser reservado" (409 ao confirmar)**
```
| +----------------------------+ |
| | (!) Esse horário acabou de | |  Alert error, role="alert"
| | ser reservado por outra    | |  foco move para o alerta
| | pessoa.                    | |
| | Escolha outro horário; seus| |
| | dados foram mantidos.      | |
| | [ Escolher outro horário ] | |  volta ao passo 3, grade recarregada,
| +----------------------------+ |  serviço/barbeiro/dados preservados
```
O slot em conflito aparece já como indisponível ao voltar; sugerir os 3 horários livres mais próximos.

**Sucesso (confirmação)**
```
+--------------------------------+
| (check) Agendamento confirmado!|  h1, role="status", foco no h1
| Corte clássico com Nome A      |
| qui, 14 de novembro · 09:15    |
| Duração 30 min · R$ 45,00      |
| Rua Inventada, 123 (fictício)  |
| [ Adicionar ao calendário .ics]|
| [ Gerenciar agendamento ]      |  link /agendamento/[token]
| (!) Guarde este link: é a única|
|     forma de gerenciar. [Copiar]|
| Lembrete: cancelamento até 2 h |
| antes. Projeto fictício.       |
| [ Voltar ao site ]             |
+--------------------------------+
```

**Desktop `/agendar`**
```
+----------------------------------------------------------------+
| COBRE VELHO                                  [Voltar ao site]  |
| (1 Serviço)--(2 Barbeiro)--(3 Data e hora)--(4 Dados)          |
+----------------------------------------+-----------------------+
| h2: Escolha data e horário             | SEU AGENDAMENTO       |
| <  [qui][sex][sáb][dom]...  >          | Corte clássico  R$45  |
| Manhã  [09:00][09:15*][09:30][09:45x]  | Barbeiro: Nome A      |
| Tarde  [14:00][14:15] ...              | Data: qui, 14 nov     |
|                                        | Hora: 09:15           |
| [ Voltar ]            [ Continuar ]    | Total: R$ 45,00 (fict)|
+----------------------------------------+-----------------------+
```

### 7.3 `/agendamento/[token]`

**Mobile**
```
+--------------------------------+
| COBRE VELHO     [Voltar ao site]|
| h1: Seu agendamento            |
| Status: (●) Confirmado         |  selo texto + ícone
| Corte clássico                 |
| Nome A                         |
| qui, 14 nov · 09:15 - 09:45    |
| Rua Inventada, 123 (fictício)  |
| +----------------------------+ |
| | Você pode cancelar ou      | |
| | reagendar até 2 h antes    | |
| | (até 07:15).               | |
| +----------------------------+ |
| [ Reagendar ]                  |
| [ Cancelar agendamento ]       |  secundário
| [ Baixar .ics ]  ghost         |
+--------------------------------+
```
Estados:
- **Cancelar:** `<dialog>` "Cancelar este agendamento?" + "Sim, cancelar" (perigo: borda `error`, texto
  `error`; nunca botão vermelho preenchido sem verificação de contraste) e "Manter agendamento" (foco inicial).
  Sucesso: Alert "Agendamento cancelado. Esperamos você em outra hora." + [Agendar novo horário].
- **Fora da janela (< 2 h):** botões desabilitados + Alert aviso "Faltam menos de 2 horas. Para alterar, fale
  com a barbearia pelo WhatsApp (número fictício)."
- **Já cancelado/concluído:** selo de status + EmptyState sem ações.
- **Token inválido/expirado:** EmptyState "Não encontramos este agendamento" + [Fazer novo agendamento].
  (Mesma mensagem para inexistente e expirado, sem vazar informação.)
- **Reagendar:** reusa passo 3 do `/agendar` com serviço/barbeiro fixos.
- **Desktop:** cartão central de 560px, mesma estrutura, botões em linha.

### 7.4 `/admin/login`

```
+--------------------------------+
| Painel · Cobre Velho (fictício)|
| h1: Entrar                     |
| (!) Usuário ou senha inválidos.|  Alert error genérico, role="alert"
| Usuário                        |
| [______________________]       |
| Senha                          |
| [______________] [mostrar]     |  botão mostrar/ocultar 44x44, aria-pressed
| [        Entrar         ]      |  carregando: spinner + "Entrando..."
| Muitas tentativas? aguarde 15  |
| minutos.                       |
+--------------------------------+
```
Desktop: cartão 400px centralizado em `bg`. Sem link de cadastro. `noindex`. Bloqueio por tentativas:
Alert aviso "Muitas tentativas. Tente de novo em 15 minutos." Mensagem de erro **sempre genérica**.

### 7.5 `/admin` (agenda + bloqueio)

**Mobile**
```
+--------------------------------+
| Agenda            [Sair]       |
| [ Dia | Semana ]  (tablist)    |
| <  qui, 14 nov  >  [Hoje]      |
| Barbeiro: [Todos ▾]            |
+--------------------------------+
| 09:00 - 09:30  Corte clássico  |
| João S. · (11) 9xxxx-0000*     |
| Nome A    (●) Confirmado       |
| [Concluído][Não compareceu][⋯] |
+--------------------------------+
| 09:30 - 10:30  ▒ BLOQUEIO      |
| Almoço · Nome A                |
| [ Remover bloqueio ]           |
+--------------------------------+
| 10:00 - 10:30  (livre)         |
|   [ + Bloquear horário ]       |
+--------------------------------+
| [ + Novo bloqueio ]  (fixo)    |
+--------------------------------+
```
Mobile mostra a visão em **lista cronológica** agrupada por barbeiro; semana vira lista por dia (accordion).

**Desktop (1280px) — visão dia**
```
+----------------------------------------------------------------------+
| Agenda · Cobre Velho (fictício)                         [Sair]       |
| [Dia|Semana]  <  qui, 14 nov  >  [Hoje]       [+ Novo bloqueio]      |
+------+-----------------------+-----------------------+---------------+
| hora | Nome A                | Nome B                | Nome C        |
+------+-----------------------+-----------------------+---------------+
| 09:00| Corte clássico        |                       | ▒ Almoço      |
|      | João S. (●) Confirm.  |                       |               |
| 09:30| ...                   | Barba · Pedro (●)     | ▒ ...         |
+------+-----------------------+-----------------------+---------------+
```
Visão semana: colunas = dias, filtro por barbeiro (select) em vez de colunas por barbeiro; blocos coloridos
por status **com rótulo de texto** (Confirmado, Concluído, Não compareceu, Cancelado, Bloqueio).

**Modal "Novo bloqueio"** (`<dialog>`): barbeiro (select), data (date), início/fim (select 15 min),
motivo (Almoço, Folga, Outro + texto). Validação: fim > início; conflito com agendamento confirmado mostra
Alert aviso "Há 1 agendamento neste período. Cancele-o antes de bloquear." Sucesso: Toast "Bloqueio criado".
**Remover bloqueio:** confirmação inline curta. **Cancelar atendimento:** `<dialog>` de confirmação.
Estados: carregando (Skeleton de linhas), vazio ("Sem agendamentos neste dia" + [Novo bloqueio]),
erro de rede (Alert error + [Tentar de novo]). Dados pessoais só com sessão ativa; telefones fictícios.

## 8. Acessibilidade e imagens

### 8.1 Acessibilidade (WCAG 2.1 AA)
- **Landmarks:** `<header>`, `<nav aria-label>`, `<main id="conteudo">` (único), `<footer>`; seções com
  `aria-labelledby`. Skip link visível ao focar.
- **Foco:** anel `focus` 3px + offset 2px em tudo que é interativo, nunca `outline: none` sem substituto.
  Ordem de foco = ordem visual. Dialogs: foco inicial no título/ação segura, foco preso, retorna ao gatilho.
- **Teclado:** tudo operável por teclado; menu `Esc`; radio groups por setas; dialogs `Esc`; sem armadilha.
- **Alvo mínimo 44x44px** (botões, links de ícone, slots, itens de menu, checkbox com área do rótulo);
  espaço >= 8px entre alvos adjacentes.
- **Formulários:** `label` sempre visível, `autocomplete`, `aria-invalid`, `aria-describedby`, resumo de
  erros com foco, erros em texto + ícone, `required` + indicação textual "(obrigatório)" além do asterisco.
- **Cor:** nunca única forma de informação (slot riscado, selo com texto, ícone de erro).
- **Idioma e títulos:** `<html lang="pt-BR">`; `<title>` único por rota e atualizado a cada passo do
  agendamento; um `h1` por página; níveis sem saltos.
- **Anúncios dinâmicos:** `aria-live="polite"` em contagem de horários; `role="alert"` em erros; foco movido
  ao `h2`/resumo em troca de etapa.
- **Movimento:** `prefers-reduced-motion: reduce` desativa shimmer, zoom, rolagem suave, parallax e
  transições (CSS no bloco `@theme`). Nada pisca > 3x/s. Sem carrossel automático.
- **Zoom/reflow:** funciona a 200% e 320 CSS px sem rolagem horizontal; texto em `rem`; não bloquear zoom no viewport.
- **Meta:** `meta name="color-scheme" content="dark"`; `forced-colors`: bordas e foco mantêm `outline` real
  (não só `box-shadow`) para Modo de Alto Contraste do Windows.
- **Teste:** axe/Lighthouse >= 90 (SPEC §5) + checagem manual com teclado e leitor de tela (NVDA).

### 8.2 Imagens
- **Alt text:** informativas descrevem o conteúdo ("Barbeiro aplicando navalha na barba de cliente");
  decorativas `alt=""`; ícones `aria-hidden`; botões só-ícone com `aria-label`. Fotos de pessoas: dizer que
  são ilustrativas/fictícias no alt do barbeiro e na legenda geral "Fotos ilustrativas".
- **Proporções e tamanhos-alvo** (todas via `astro:assets`, com `width`/`height` para evitar CLS):

| Uso | Proporção | Larguras geradas | Peso alvo (AVIF/WebP) |
|---|---|---|---|
| Hero | 16:10 mobile, 4:5 desktop (lado) | 640, 960, 1280 | <= 120 KB (mobile <= 60 KB) |
| Sobre | 1:1 | 480, 800 | <= 70 KB |
| BarberCard | 4:5 | 320, 480, 640 | <= 40 KB |
| Galeria (miniatura) | 1:1 | 320, 480 | <= 30 KB |
| Galeria (ampliada) | 3:2 ou 4:5 | 1200 | <= 150 KB |
| Open Graph | 1200x630 | 1200 | <= 150 KB (JPG/PNG por compatibilidade) |

- **Formatos:** AVIF com fallback WebP (e JPG só para OG); `sizes` corretos; qualidade ~70-75.
- **Carregamento:** hero (LCP) com `loading="eager"` + `fetchpriority="high"`, sem lazy; demais
  `loading="lazy"` + `decoding="async"`; MapEmbed com facade; fontes com preload só dos 2 arquivos críticos.
- **Tratamento:** sobreposição de gradiente `bg` 60-80% sob texto sobre foto (conferir 4,5:1 do texto real
  na pior região da foto); tom quente/cobre consistente (mesmo ajuste de cor em todas).
- **Fontes de fotos livres (licença compatível; verificar a licença de cada foto no momento do uso e
  registrar autor/URL em `docs/` ou `CREDITS.md`; nada foi baixado):**
  1. **Unsplash** (unsplash.com): Licença Unsplash, uso comercial e sem atribuição obrigatória (recomendada).
     Restrição: não revender as fotos isoladas nem montar serviço concorrente.
  2. **Pexels** (pexels.com): Licença Pexels, uso gratuito, atribuição não obrigatória; não vender as fotos
     sem alteração; cuidado com pessoas identificáveis.
  3. **Pixabay** (pixabay.com): Licença Pixabay (conteúdo), uso gratuito; evitar reuso identificável de pessoas
     e marcas. Alternativa extra: **Wikimedia Commons**, só arquivos CC0/CC BY (atribuir).
  Cuidados: evitar fotos com logotipos/marcas reais visíveis, rostos de pessoas reais apresentadas como
  funcionários nomeados (usar nomes inventados e dizer que são ilustrativas) e fotos com model release
  duvidoso. Como alternativa segura: ilustrações vetoriais ou fotos de produtos/ferramentas sem rosto.

## 9. Microcopy (pt-BR)

Tom: direto, caloroso, sem gíria excessiva; frases curtas; "você". Todo valor comercial acompanhado, em
algum ponto da página, do aviso de fictício.

### 9.1 CTAs
| Local | Texto |
|---|---|
| Header / Hero (primário) | Agendar horário |
| Hero (secundário) | Ver serviços |
| ServiceCard | Agendar este serviço |
| BarberCard | Agendar com [nome] |
| Passos do fluxo | Continuar · Voltar · Confirmar agendamento |
| Dados do cliente | Confirmar agendamento |
| Confirmação | Adicionar ao calendário · Gerenciar agendamento · Voltar ao site |
| Gerenciar | Reagendar · Cancelar agendamento · Baixar .ics |
| Dialog cancelar | Sim, cancelar · Manter agendamento |
| Mapa | Carregar mapa · Abrir no Google Maps |
| WhatsApp | Falar no WhatsApp |
| Admin | Entrar · Sair · Novo bloqueio · Remover bloqueio · Marcar como concluído · Não compareceu |

### 9.2 Mensagens de erro e validação
| Situação | Mensagem |
|---|---|
| Nome vazio | Informe seu nome. |
| Nome curto | Digite seu nome completo (mínimo 3 letras). |
| Telefone vazio | Informe seu telefone com DDD. |
| Telefone inválido | Telefone inválido. Use o formato (11) 91234-5678. |
| Consentimento | Para agendar, precisamos do seu consentimento. |
| Serviço/barbeiro/data/hora | Escolha um serviço. · Escolha um barbeiro ou "sem preferência". · Escolha uma data. · Escolha um horário. |
| Resumo de erros | Corrija {n} campo(s) para continuar. |
| Conflito (409) | Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário; seus dados foram mantidos. |
| Horário no passado/fora da janela | Esse horário não está mais disponível. Escolha outro. |
| Sem horários | Sem horários neste dia. Tente outra data ou outro barbeiro. |
| Falha de rede / 5xx | Não foi possível concluir agora. Verifique sua conexão e tente de novo. |
| Falha ao carregar horários | Não conseguimos carregar os horários. [Tentar de novo] |
| Token inválido | Não encontramos este agendamento. Ele pode ter expirado ou o link está incompleto. |
| Fora da janela de 2 h | Faltam menos de 2 horas para o horário. Para alterar, fale com a barbearia (WhatsApp fictício). |
| Login inválido | Usuário ou senha inválidos. |
| Login bloqueado | Muitas tentativas. Tente de novo em 15 minutos. |
| Sessão expirada | Sua sessão expirou. Entre novamente. |
| Bloqueio com conflito | Há agendamento neste período. Cancele-o antes de criar o bloqueio. |
| Erro genérico | Algo deu errado do nosso lado. Tente de novo em instantes. |

### 9.3 Confirmações e estados vazios
| Situação | Mensagem |
|---|---|
| Agendado | Agendamento confirmado! Te esperamos em {dia}, às {hora}. |
| Aviso do link | Guarde este link: é a única forma de gerenciar seu agendamento. |
| Link copiado | Link copiado. |
| Cancelado | Agendamento cancelado. Esperamos você em outra hora. |
| Reagendado | Agendamento remarcado para {dia}, às {hora}. |
| Bloqueio criado/removido | Bloqueio criado. · Bloqueio removido. |
| Atendimento atualizado | Atendimento marcado como concluído. · Marcado como não compareceu. |
| Admin vazio | Sem agendamentos neste dia. |
| Serviços vazios | Serviços em atualização. Volte em breve. |
| Galeria vazia | Fotos em breve. |
| Rodapé | Barbearia fictícia — projeto de portfólio. |
| Ajuda do telefone | Usamos seu telefone só para este agendamento. |
| Selo preços | Valores fictícios, apenas para demonstração. |
| Carregando | Carregando... (sr-only + Skeleton) |

## 10. Decisões pendentes (para aprovação)
1. Nome "Cobre Velho Barbearia" e direção escura/cobre.
2. Fraunces + Inter auto-hospedadas (adicionar arquivos WOFF2 ou pacote `@fontsource-variable`; este último
   é dependência nova, exige aprovação).
3. Tema único escuro (sem alternância claro/escuro no MVP).
4. DatePicker como faixa de 30 dias (sem grade mensal) no MVP.
5. MapEmbed com facade (clique para carregar) em vez de iframe direto.
6. Fonte das fotos (Unsplash vs. ilustrações) e política de registro de créditos.
