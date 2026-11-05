import { describe, expect, it } from 'vitest';
import { buildWhatsappUrl, normalizeWhatsappNumber } from '@/lib/whatsapp';

describe('normalizeWhatsappNumber', () => {
  it('mantém só dígitos', () => {
    expect(normalizeWhatsappNumber('+55 (11) 91234-5678', '5500000000000')).toBe('5511912345678');
  });
  it('usa o fallback quando vazio, indefinido ou curto demais', () => {
    expect(normalizeWhatsappNumber(undefined, '5500000000000')).toBe('5500000000000');
    expect(normalizeWhatsappNumber('', '5500000000000')).toBe('5500000000000');
    expect(normalizeWhatsappNumber('123', '5500000000000')).toBe('5500000000000');
  });
});

describe('buildWhatsappUrl', () => {
  it('monta o link wa.me sem mensagem', () => {
    expect(buildWhatsappUrl('5500000000000')).toBe('https://wa.me/5500000000000');
  });
  it('codifica a mensagem', () => {
    expect(buildWhatsappUrl('5500000000000', 'Olá! Tudo bem?')).toBe(
      'https://wa.me/5500000000000?text=Ol%C3%A1!%20Tudo%20bem%3F',
    );
  });
});
