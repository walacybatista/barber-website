import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError } from './log';

describe('logError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loga só o nome do Error, nunca a message com SQL/params', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('[t]', new Error('Failed query: select ... params: 11999990000'));
    expect(spy).toHaveBeenCalledWith('[t]', 'Error');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('11999990000');
  });

  it('inclui o código da causa quando existe', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('violação'), { cause: { code: '23P01' } });
    logError('[t]', err);
    expect(spy).toHaveBeenCalledWith('[t]', 'Error (23P01)');
  });

  it('valor não-Error loga o tipo', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('[t]', 'boom');
    expect(spy).toHaveBeenCalledWith('[t]', 'string');
  });
});
