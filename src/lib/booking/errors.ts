/** Erros de domínio. Sem parameter properties (compatível com type stripping do Node). */
export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class SlotTakenError extends DomainError {
  constructor(message = 'Esse horário acabou de ser reservado.') {
    super('SLOT_TAKEN', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(what = 'Registro') {
    super('NOT_FOUND', `${what} não encontrado.`);
  }
}

/** Horário fora do expediente, não alinhado a 15 min ou fora da janela (RN02/RN03). */
export class InvalidSlotError extends DomainError {
  reason: string;
  constructor(reason: string) {
    super('INVALID_SLOT', 'Horário indisponível para agendamento.');
    this.reason = reason;
  }
}

/** RN04: menos de 2 h para o início. */
export class TooLateError extends DomainError {
  constructor() {
    super('TOO_LATE', 'Cancelamento e reagendamento só até 2 horas antes do horário.');
  }
}

export class InvalidStateError extends DomainError {
  constructor(message = 'Operação não permitida no estado atual do agendamento.') {
    super('INVALID_STATE', message);
  }
}

/**
 * Barbeiro do agendamento está inativo: reagendar/listar horários é recusado. Estende
 * `InvalidStateError` e mantém o código `INVALID_STATE` de propósito: `toActionError`
 * (src/actions) já o traduz para CONFLICT; um código novo cairia em BAD_REQUEST. A causa
 * fica em `reason` ('BARBER_UNAVAILABLE').
 */
export class BarberUnavailableError extends InvalidStateError {
  reason = 'BARBER_UNAVAILABLE';
  constructor() {
    super('Este barbeiro não está mais disponível.');
  }
}

export class InvalidInputError extends DomainError {
  constructor(message: string) {
    super('INVALID_INPUT', message);
  }
}

/** Anti-spam: telefone já tem o máximo de agendamentos confirmados futuros. */
export class TooManyBookingsError extends DomainError {
  /** `max` fica só no objeto (logs/testes); a mensagem ao cliente não revela a contagem. */
  max: number;
  constructor(max: number) {
    super(
      'TOO_MANY_BOOKINGS',
      'Não foi possível concluir o agendamento por este telefone agora. Fale com a barbearia.',
    );
    this.max = max;
  }
}

/**
 * Bloqueio de agenda sobre horário já ocupado (agendamento ou outro bloqueio). Mantém o código
 * `SLOT_TAKEN` (e a superclasse) para o mapeamento HTTP existente; a mensagem é para o admin.
 */
export class BlockConflictError extends SlotTakenError {
  constructor() {
    super(
      'Já existe agendamento ou bloqueio nesse período. Cancele o agendamento antes de bloquear.',
    );
  }
}
