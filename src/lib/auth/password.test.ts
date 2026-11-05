import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.ts';

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
