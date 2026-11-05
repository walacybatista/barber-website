import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from './password.ts';

describe('password (scrypt)', () => {
  it('verifica senha correta e rejeita errada; salt aleatório', async () => {
    const h1 = await hashPassword('correct horse battery');
    const h2 = await hashPassword('correct horse battery');
    expect(h1).not.toBe(h2);
    expect(h1.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', h1)).toBe(true);
    expect(await verifyPassword('wrong', h1)).toBe(false);
  });
  it('hash malformado vira false, sem lançar', async () => {
    expect(await verifyPassword('x', 'lixo')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$a$b$c$d$e')).toBe(false);
  });
});

describe('needsRehash', () => {
  it('hash atual não precisa; parâmetros antigos ou N menor precisam', async () => {
    const h = await hashPassword('x-senha-longa-123');
    expect(needsRehash(h)).toBe(false);
    expect(h.split('$')[1]).toBe(String(2 ** 17));
    const parts = h.split('$');
    parts[1] = String(2 ** 15);
    expect(needsRehash(parts.join('$'))).toBe(true);
    expect(needsRehash('lixo')).toBe(false);
  });
});
