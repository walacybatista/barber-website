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
  constructor() {
    super('SLOT_TAKEN', 'Esse horário acabou de ser reservado.');
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

export class InvalidInputError extends DomainError {
  constructor(message: string) {
    super('INVALID_INPUT', message);
  }
}

/** Anti-spam: telefone já tem o máximo de agendamentos confirmados futuros. */
export class TooManyBookingsError extends DomainError {
  constructor(max: number) {
    super(
      'TOO_MANY_BOOKINGS',
      `Você já tem ${max} agendamentos futuros. Cancele um ou aguarde para marcar outro.`,
    );
  }
}
