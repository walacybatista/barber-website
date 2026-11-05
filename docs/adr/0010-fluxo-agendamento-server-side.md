# ADR-010 — Fluxo de agendamento renderizado no servidor

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead, ui-engineer

## Contexto
O fluxo `/agendar` tem 4 passos (serviço → barbeiro → data/horário → dados + consentimento). Precisa funcionar
bem em celular com rede ruim, ser acessível e reaproveitar as Astro Actions já existentes.

## Decisão
Passos renderizados no servidor, com o estado na query string
(`/agendar?servico=<slug>&barbeiro=<slug|qualquer>&data=YYYY-MM-DD&hora=<ISO UTC>`). Cada passo é um
`<form method="get">`; os horários livres são calculados no frontmatter (servidor) via `listAvailability`.
O envio final é um `<form method="POST">` para a Action `createBooking` com `accept: 'form'`.
Sucesso redireciona para `/agendamento/<token>` (token nunca em query string).

## Alternativas
- **Ilha interativa no cliente** (`actions.getAvailability()` via JS): transições sem recarregar, mas exige JS,
  estado no cliente, tratamento manual do botão "voltar" e mais testes. Mantida como evolução possível.

## Consequências
- (+) Funciona sem JavaScript; "voltar" do navegador e URLs compartilháveis funcionam naturalmente.
- (+) Zero JS adicional; testes E2E simples (`javaScriptEnabled: false`).
- (−) Cada passo recarrega a página (HTML pequeno; aceitável para uso esporádico).
- (−) Parâmetros da URL são entrada do usuário: o servidor valida todos e nunca responde 500 por parâmetro
  inválido.
- (−) Trade-off aceito (revisão 2026-11-05): após erro no envio final (conflito de horário, validação), a página
  é a resposta de um POST para preservar nome e telefone sem colocá-los na URL. Nesse estado, atualizar a página
  pede reenvio do formulário. Alternativa descartada: redirecionar para GET e pedir os dados de novo (pior UX).
  Escolher outra DATA a partir desse estado volta para GET e descarta nome/telefone — a interface só promete
  preservar os dados ao escolher outro horário do mesmo dia.
- Corpo de POST limitado a 16 KB antes de ser lido pela página (o limite do adaptador Node é muito maior).
