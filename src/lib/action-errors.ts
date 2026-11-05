import { InvalidCredentialsError } from './auth/login.ts';
import { DomainError, InvalidStateError } from './booking/errors.ts';
import { logError } from './log.ts';
import { RateLimitedError } from './rate-limit.ts';

/** Sem import de astro: mapeamento puro de erro de domínio para o par código/mensagem da Action. */
export type ActionErrorInit = { code: string; message: string };

export const INTERNAL_ERROR_MESSAGE = 'Erro interno. Tente novamente.';

export function mapErrorToAction(err: unknown): ActionErrorInit {
  if (err instanceof RateLimitedError) return { code: 'TOO_MANY_REQUESTS', message: err.message };
  if (err instanceof InvalidCredentialsError) return { code: 'UNAUTHORIZED', message: err.message };
  // Barbeiro inativo (reagendar): código próprio, para a página não confundir com "horário reservado".
  if (err instanceof InvalidStateError && 'reason' in err && err.reason === 'BARBER_UNAVAILABLE') {
    return { code: 'PRECONDITION_FAILED', message: err.message };
  }
  if (err instanceof DomainError) {
    const code =
      err.code === 'TOO_MANY_BOOKINGS'
        ? 'TOO_MANY_REQUESTS'
        : err.code === 'SLOT_TAKEN' || err.code === 'INVALID_STATE'
          ? 'CONFLICT'
          : err.code === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : err.code === 'TOO_LATE'
              ? 'FORBIDDEN'
              : 'BAD_REQUEST';
    return { code, message: err.message };
  }
  // Não mapeado: nunca repassa `message` (pode vazar SQL, host, valores). Loga só nome/código.
  logError('action: erro não mapeado', err);
  return { code: 'INTERNAL_SERVER_ERROR', message: INTERNAL_ERROR_MESSAGE };
}
