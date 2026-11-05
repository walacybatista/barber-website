import { describe, expect, it } from 'vitest';
import { createLimiter, hashPassword, scryptLimiter, verifyPassword } from '@/lib/auth/password';

describe('createLimiter', () => {
  it('nunca passa de 2 tarefas ativas e respeita FIFO', async () => {
    const limiter = createLimiter(2);
    let active = 0;
    let max = 0;
    const order: number[] = [];
    const task = (i: number) =>
      limiter.run(async () => {
        order.push(i);
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      });
    await Promise.all([0, 1, 2, 3, 4].map(task));
    expect(max).toBe(2);
    expect(limiter.peak).toBe(2);
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it('libera a vaga quando a tarefa falha', async () => {
    const limiter = createLimiter(1);
    await expect(limiter.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('scrypt do processo', () => {
  it('5 hash/verify simultâneos: no máximo 2 ativos', async () => {
    const stored = await hashPassword('segredo');
    scryptLimiter.peak = 0;
    const results = await Promise.all([
      hashPassword('a'),
      hashPassword('b'),
      verifyPassword('segredo', stored),
      verifyPassword('errada', stored),
      hashPassword('c'),
    ]);
    expect(scryptLimiter.peak).toBeLessThanOrEqual(2);
    expect(results[2]).toBe(true);
    expect(results[3]).toBe(false);
  }, 30_000);
});

describe('createLimiter: falha com fila', () => {
  it('tarefa que falha passa a vaga para a próxima da fila', async () => {
    const limiter = createLimiter(1);
    const order: string[] = [];
    const failing = limiter.run(async () => {
      order.push('a');
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('falhou');
    });
    const next = limiter.run(async () => {
      order.push('b');
      return 'b-ok';
    });
    await expect(failing).rejects.toThrow('falhou');
    await expect(next).resolves.toBe('b-ok');
    expect(order).toEqual(['a', 'b']);
  });
});
