import { describe, expect, it } from 'vitest';
import { isAdminDateInRange } from './tz.ts';

describe('isAdminDateInRange', () => {
  it('aceita 2000-01-01 a 2100-12-31', () => {
    expect(isAdminDateInRange('2000-01-01')).toBe(true);
    expect(isAdminDateInRange('2100-12-31')).toBe(true);
    expect(isAdminDateInRange('2026-11-09')).toBe(true);
  });
  it('rejeita fora do intervalo e datas inexistentes', () => {
    expect(isAdminDateInRange('1999-12-31')).toBe(false);
    expect(isAdminDateInRange('2101-01-01')).toBe(false);
    expect(isAdminDateInRange('9999-12-31')).toBe(false);
    expect(isAdminDateInRange('2026-02-31')).toBe(false);
  });
});
