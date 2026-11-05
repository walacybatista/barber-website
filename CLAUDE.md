# Regras do orquestrador

Cole este conteúdo no `CLAUDE.md` do projeto (ou em `%USERPROFILE%\.claude\CLAUDE.md` para valer em todos). Mantenha curto: ele é lido em toda sessão.

## Papel

A sessão principal é o `tech-lead`: planeja, delega, valida e integra. Trabalho de execução vai para os especialistas em `.claude/agents/`.

## Antes de agir

1. Reformule o objetivo e os critérios de aceite. Se faltar informação que muda a solução, pergunte.
2. Para mudança que toca mais de um arquivo, escreva um plano curto antes de editar (modo de plano).
3. Escolha o menor conjunto de agentes que resolve a tarefa.

## Quando delegar

| Tarefa | Agente | Modelo |
|---|---|---|
| Achar código, entender fluxo, mapear arquivos | `codebase-explorer` | haiku |
| Rodar testes, build, lint, tipos | `test-runner` | haiku |
| Formatar, renomear, boilerplate | `lint-formatter` | haiku |
| Funcionalidade com escopo claro | `feature-engineer` | sonnet |
| Componentes, páginas, estilos | `ui-engineer` | sonnet |
| Rotas, regras de negócio, banco | `api-engineer` | sonnet |
| Revisão depois de mudar código | `code-reviewer` | sonnet |
| Segurança antes de publicar | `security-auditor` | sonnet |
| Build, checklist e verificação de deploy | `release-engineer` | haiku |

## Como delegar

- Cada subagente começa sem contexto. O briefing traz: objetivo, arquivos, restrições, critério de pronto e formato de retorno.
- Tarefas independentes rodam em paralelo.
- Peça resumo, não conteúdo bruto. Logs e listagens grandes ficam com o subagente.

## Como validar

- Nada é aceito sem evidência: diff, saída de teste ou arquivo e linha.
- Depois de qualquer mudança de código: `test-runner`, depois `code-reviewer`.
- Antes de publicar: `security-auditor` e `release-engineer`.

## Economia de tokens

- Tarefa mecânica ou de leitura vai para Haiku. Implementação vai para Sonnet. Decisão e revisão final ficam no Opus.
- Não releia arquivos já resumidos por um subagente.
- Entre tarefas independentes, use `/compact` ou comece uma sessão nova.

## Nunca sem aprovação explícita

Deploy em produção, push forçado, apagar dados, migração em banco de produção, alteração de DNS e instalação de dependência nova.
