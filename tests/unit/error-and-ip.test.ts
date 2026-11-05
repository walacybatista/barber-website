import { describe, expect, it } from 'vitest';
import { mapErrorToAction } from '@/lib/action-errors';
import { normalizeClientIp } from '@/lib/client-ip';
import { InvalidInputError } from '@/lib/booking/errors';

describe('mapErrorToAction', () => {
  it('InvalidInputError vira BAD_REQUEST', () => {
    expect(mapErrorToAction(new InvalidInputError('Nome inválido.'))).toEqual({
      code: 'BAD_REQUEST',
      message: 'Nome inválido.',
    });
  });
});

describe('normalizeClientIp', () => {
  it('\0 ou espaço interno viram unknown', () => {
    expect(normalizeClientIp('1.2.3.4\0')).toBe('unknown');
    expect(normalizeClientIp('1.2.3.4\0:80')).toBe('unknown');
    expect(normalizeClientIp('1.2 .3.4')).toBe('unknown');
    expect(normalizeClientIp('2001:db8::1 2')).toBe('unknown');
  });
});
