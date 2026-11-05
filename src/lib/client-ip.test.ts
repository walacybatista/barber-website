import { describe, expect, it } from 'vitest';
import { normalizeClientIp } from './client-ip.ts';

describe('normalizeClientIp', () => {
  it('mantém IPv4', () => expect(normalizeClientIp('203.0.113.7')).toBe('203.0.113.7'));
  it('IPv4-mapeado vira IPv4', () => {
    expect(normalizeClientIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeClientIp('::ffff:cb00:7107')).toBe('203.0.113.7');
  });
  it('IPv6 vira /64', () => {
    expect(normalizeClientIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(normalizeClientIp('2001:DB8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(normalizeClientIp('2001:db8:1:2::1')).toBe(normalizeClientIp('2001:db8:1:2:ffff::9'));
    expect(normalizeClientIp('2001:db8:1:3::1')).not.toBe(normalizeClientIp('2001:db8:1:2::1'));
  });
  it('comprimidos e loopback', () => {
    expect(normalizeClientIp('::1')).toBe('0:0:0:0::/64');
    expect(normalizeClientIp('::')).toBe('0:0:0:0::/64');
    expect(normalizeClientIp('2001:db8::')).toBe('2001:db8:0:0::/64');
    expect(normalizeClientIp('fe80::1')).toBe('fe80:0:0:0::/64');
  });
  it('descarta zona', () => {
    expect(normalizeClientIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(normalizeClientIp('192.0.2.1%eth0')).toBe('192.0.2.1');
  });
  it('inválido vira unknown', () => {
    expect(normalizeClientIp('')).toBe('unknown');
    expect(normalizeClientIp(undefined)).toBe('unknown');
    expect(normalizeClientIp('lixo')).toBe('unknown');
    expect(normalizeClientIp('1:2:3')).toBe('unknown');
    expect(normalizeClientIp('1::2::3')).toBe('unknown');
  });
});
