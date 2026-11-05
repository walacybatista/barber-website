import type { Business } from '@/data/business';
import { formatBRL } from '@/lib/format';
import { schemaDayName } from '@/lib/hours';

/** JSON-LD schema.org BarberShop gerado de business.ts. */
export function buildBarberShopJsonLd(
  b: Business,
  siteUrl: string,
  /** `whatsapp`: número já normalizado (whatsappNumber()); sem ele usa o fictício de business. */
  opts: { image?: string; whatsapp?: string } = {},
) {
  const prices = b.services.map((s) => s.priceCents);
  // Sem serviços não há faixa de preço (Math.min() vazio daria Infinity e formatBRL lançaria).
  // formatBRL usa NBSP entre "R$" e o valor; troca por espaço comum no JSON-LD.
  const priceRange =
    prices.length > 0
      ? `${formatBRL(Math.min(...prices))} - ${formatBRL(Math.max(...prices))}`.replace(
          /[\u00A0\u202F]/g,
          ' ',
        )
      : undefined;
  const base = siteUrl.replace(/\/$/, '');

  // Agrupa dias com o mesmo horário em uma única especificação.
  const groups = new Map<string, { days: string[]; opens: string; closes: string }>();
  for (const h of b.openingHours) {
    const key = `${h.open}-${h.close}`;
    const g = groups.get(key) ?? { days: [], opens: h.open, closes: h.close };
    g.days.push(schemaDayName(h.weekday));
    groups.set(key, g);
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BarberShop',
    '@id': `${base}/#barbershop`,
    name: b.name,
    description: b.description,
    url: `${base}/`,
    ...(opts.image ? { image: opts.image } : {}),
    telephone: `+${opts.whatsapp ?? b.whatsapp}`,
    email: b.email,
    ...(priceRange ? { priceRange } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address.street,
      addressLocality: b.address.city,
      addressRegion: b.address.region,
      postalCode: b.address.postalCode,
      addressCountry: b.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: b.geo.lat, longitude: b.geo.lng },
    openingHoursSpecification: [...groups.values()].map((g) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: g.days,
      opens: g.opens,
      closes: g.closes,
    })),
  };
}

/** Serializa para <script type="application/ld+json"> sem permitir fechar a tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
