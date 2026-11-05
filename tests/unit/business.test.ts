import { describe, expect, it } from 'vitest';
import { business } from '@/data/business';
import { groupHours } from '@/lib/hours';
import { getAsset } from '@/lib/images';
import { buildBarberShopJsonLd, serializeJsonLd } from '@/lib/seo';
import { buildWhatsappUrl, formatPhoneDisplay, normalizeWhatsappNumber } from '@/lib/whatsapp';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

describe('business', () => {
  it('serviços com duração múltipla de 15 e preço em centavos inteiros', () => {
    expect(business.services.length).toBeGreaterThanOrEqual(5);
    for (const s of business.services) {
      expect(s.durationMin % 15).toBe(0);
      expect(Number.isInteger(s.priceCents)).toBe(true);
      expect(s.priceCents).toBeGreaterThan(0);
    }
  });
  it('slugs únicos', () => {
    const slugs = business.services.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('imagens', () => {
  it('getAsset resolve todo photo de barbeiro e todo images.*.file', () => {
    const files = [
      ...business.barbers.map((b) => b.photo),
      business.images.hero.file,
      business.images.about.file,
      ...business.images.gallery.map((g) => g.file),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(() => getAsset(f), f).not.toThrow();
  });
  it('getAsset lança para arquivo inexistente', () => {
    expect(() => getAsset('nao/existe.svg')).toThrow(/não encontrada/);
  });
});

describe('horários', () => {
  it('HH:MM, abre antes de fechar e múltiplos de 15 min', () => {
    for (const h of business.openingHours) {
      expect(h.open).toMatch(HHMM);
      expect(h.close).toMatch(HHMM);
      expect(toMin(h.open)).toBeLessThan(toMin(h.close));
      expect(toMin(h.open) % 15).toBe(0);
      expect(toMin(h.close) % 15).toBe(0);
    }
  });
  it('weekday sem duplicata', () => {
    const days = business.openingHours.map((h) => h.weekday);
    expect(new Set(days).size).toBe(days.length);
  });
  it('groupHours com lista vazia marca a semana toda como fechada', () => {
    expect(groupHours([])).toEqual([{ label: 'Seg a Dom', open: null, close: null }]);
  });
});

describe('whatsapp', () => {
  it('teto de 15 dígitos (E.164): acima disso usa o fallback', () => {
    expect(normalizeWhatsappNumber('1'.repeat(15), '5500000000000')).toBe('1'.repeat(15));
    expect(normalizeWhatsappNumber('1'.repeat(16), '5500000000000')).toBe('5500000000000');
    expect(buildWhatsappUrl(normalizeWhatsappNumber('1'.repeat(16), '5500000000000'))).toBe(
      'https://wa.me/5500000000000',
    );
  });
  it('telefone exibido deriva do mesmo número', () => {
    expect(formatPhoneDisplay(business.whatsapp)).toBe('+55 (00) 00000-0000');
    expect(formatPhoneDisplay('5511912345678')).toBe('+55 (11) 91234-5678');
    expect(formatPhoneDisplay('123456789012')).toBe('+123456789012');
  });
});

describe('groupHours', () => {
  it('agrupa dias iguais e marca domingo como fechado', () => {
    const rows = groupHours(business.openingHours);
    expect(rows).toEqual([
      { label: 'Seg a Sex', open: '09:00', close: '19:00' },
      { label: 'Sábado', open: '09:00', close: '17:00' },
      { label: 'Domingo', open: null, close: null },
    ]);
  });
});

describe('JSON-LD', () => {
  const ld = buildBarberShopJsonLd(business, 'https://example.com/');
  it('é BarberShop com endereço, geo e horários', () => {
    expect(ld['@type']).toBe('BarberShop');
    expect(ld.address.addressCountry).toBe('BR');
    expect(ld.geo.latitude).toBe(business.geo.lat);
    expect(ld.openingHoursSpecification).toHaveLength(2);
    expect(ld.priceRange).toContain('R$');
  });
  it('priceRange usa espaço comum (sem NBSP)', () => {
    expect(ld.priceRange).toBe('R$ 15,00 - R$ 70,00');
  });
  it('usa o número informado no telefone', () => {
    const custom = buildBarberShopJsonLd(business, 'https://example.com/', {
      whatsapp: '5511912345678',
    });
    expect(custom.telephone).toBe('+5511912345678');
  });
  it('services vazio omite priceRange sem lançar', () => {
    const empty = buildBarberShopJsonLd({ ...business, services: [] }, 'https://example.com/');
    expect('priceRange' in empty).toBe(false);
  });
  it('serialização não deixa fechar a tag script', () => {
    expect(serializeJsonLd({ a: '</script>' })).not.toContain('</script>');
  });
});
