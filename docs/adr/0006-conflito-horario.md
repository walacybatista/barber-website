# ADR-006 — Conflito de horário impedido pelo banco

- **Data:** 2026-11-05 · **Status:** Aceita · **Agentes:** tech-lead, api-engineer

## Contexto
Dois clientes podem ver o mesmo horário livre e confirmar ao mesmo tempo (race condition). Checar
"está livre?" e depois gravar não é seguro: as duas requisições passam na checagem antes de qualquer gravação.

## Decisão
Tabela `busy_periods` com **exclusion constraint** do Postgres:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE busy_periods (
  id          bigserial PRIMARY KEY,
  barber_id   integer NOT NULL REFERENCES barbers(id),
  period      tstzrange NOT NULL,
  booking_id  bigint REFERENCES bookings(id) ON DELETE CASCADE,
  block_id    bigint REFERENCES time_blocks(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(booking_id, block_id) = 1),
  EXCLUDE USING gist (barber_id WITH =, period WITH &&)
);
```

Leitura: "não podem existir duas linhas com o mesmo `barber_id` (`=`) cujos períodos se sobreponham (`&&`)".
Criar um agendamento = inserir `bookings` + `busy_periods` na **mesma transação**. Se outro cliente reservou um
período sobreposto um instante antes, o Postgres lança erro `23P01` (exclusion_violation), a transação é
desfeita e a aplicação responde "Esse horário acabou de ser reservado". Cancelar = apagar a linha de
`busy_periods` (o booking fica com status `cancelled` para histórico). Bloqueios do barbeiro usam a mesma tabela,
então agendamento e bloqueio também nunca se sobrepõem.

Ranges são `[início, fim)` — fim exclusivo — então 10:00–10:30 e 10:30–11:00 não conflitam.

## Alternativas
- **Checagem só na aplicação:** vulnerável a race condition.
- **Tabela de slots de 15 min com UNIQUE:** funciona em qualquer banco, mas gera muitas linhas e acopla a
  granularidade ao schema.
- **Transação SERIALIZABLE:** correta, porém exige retry em falhas de serialização e é mais difícil de raciocinar.

## Consequências
- (+) Garantia no nível do banco; nenhum bug de aplicação gera conflito.
- (−) Depende de recurso específico do Postgres (`btree_gist`, disponível em Supabase e Neon).
- Teste obrigatório: duas criações concorrentes para o mesmo período → exatamente uma sucede.
