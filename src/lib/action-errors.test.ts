import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapErrorToAction } from './action-errors.ts';
import { InvalidCredentialsError } from './auth/login.ts';
import {
  BarberUnavailableError,
  NotFoundError,
  SlotTakenError,
  TooLateError,
  TooManyBookingsError,
} from './booking/errors.ts';
import { RateLimitedError } from './rate-limit.ts';

afterEach(() => vi.restoreAllMocks());

describe('mapErrorToAction', () => {
  it('mapeia erros conhecidos', () => {
    expect(mapErrorToAction(new RateLimitedError()).code).toBe('TOO_MANY_REQUESTS');
    expect(mapErrorToAction(new InvalidCredentialsError()).code).toBe('UNAUTHORIZED');
    expect(mapErrorToAction(new SlotTakenError()).code).toBe('CONFLICT');
    expect(mapErrorToAction(new NotFoundError()).code).toBe('NOT_FOUND');
    expect(mapErrorToAction(new TooLateError()).code).toBe('FORBIDDEN');
    expect(mapErrorToAction(new BarberUnavailableError()).code).toBe('PRECONDITION_FAILED');
  });

  it('TooManyBookings não revela contagem', () => {
    const r = mapErrorToAction(new TooManyBookingsError(3));
    expect(r.code).toBe('TOO_MANY_REQUESTS');
    expect(r.message).toBe(
      'Não foi possível concluir o agendamento por este telefone agora. Fale com a barbearia.',
    );
    expect(r.message).not.toMatch(/\d/);
  });

  it('erro não mapeado vira genérico, sem vazar message, e loga só nome/código', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = new Error('select * from secret where pw = hunter2', { cause: { code: '57P01' } });
    const r = mapErrorToAction(e);
    expect(r).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno. Tente novamente.' });
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain('57P01');
    expect(logged).not.toContain('hunter2');
  });

  it('valor não-Error também é genérico', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(mapErrorToAction('boom').code).toBe('INTERNAL_SERVER_ERROR');
  });
});
