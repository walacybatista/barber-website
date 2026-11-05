import { describe, expect, it } from 'vitest';
import { formatBRL } from './format';

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    // Intl usa espaço não-quebrável (U+00A0) após "R$"
    expect(formatBRL(2500)).toBe('R$\u00a025,00');
  });

  it('rejeita valores não finitos', () => {
    expect(() => formatBRL(Number.NaN)).toThrow(RangeError);
  });

  it('rejeita não inteiros e inteiros inseguros', () => {
    expect(() => formatBRL(10.5)).toThrow(RangeError);
    expect(() => formatBRL(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
