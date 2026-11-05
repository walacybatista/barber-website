/**
 * FONTE ÚNICA do conteúdo comercial (ADR-003). TS puro, sem imports de Astro:
 * também é importado pelo seed do banco.
 *
 * TUDO AQUI É FICTÍCIO: nome, endereço, telefone, preços, barbeiros e fotos.
 * Para um cliente real: editar este arquivo, o seed e as imagens em src/assets/.
 */

export type Service = {
  slug: string;
  name: string;
  description: string;
  /** Sempre múltiplo de 15 (granularidade da agenda). */
  durationMin: number;
  /** Centavos inteiros. */
  priceCents: number;
};

export type Barber = {
  slug: string;
  name: string;
  bio: string;
  specialties: string[];
  /** Caminho relativo a src/assets; a extensão é ignorada ao resolver (troque .svg por .jpg sem mexer aqui). */
  photo: string;
};

/** Dia da semana: 0 = domingo ... 6 = sábado. Dia ausente = fechado. */
export type OpeningHours = { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; open: string; close: string };

export type Address = {
  street: string;
  neighborhood: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type GalleryItem = { file: string; alt: string };

export const business = {
  name: 'Cobre Velho Barbearia',
  shortName: 'Cobre Velho',
  tagline: 'Corte clássico, hora marcada.',
  description:
    'Cobre Velho Barbearia (fictícia): corte clássico, barba na navalha e atendimento com hora marcada. Projeto de portfólio.',
  isFictional: true as const,
  address: {
    street: 'Rua das Tesouras Imaginárias, 123',
    neighborhood: 'Centro (endereço fictício)',
    city: 'São Paulo',
    region: 'SP',
    postalCode: '00000-000',
    country: 'BR',
  } satisfies Address,
  /** Coordenadas apenas ilustrativas para o mapa; não correspondem a um estabelecimento real. */
  geo: { lat: -23.5614, lng: -46.6559 },
  /**
   * Número fictício (fallback). O site aceita PUBLIC_WHATSAPP_NUMBER, embutido no build
   * (variáveis PUBLIC_* são lidas na compilação, não em runtime; ver src/lib/whatsapp.ts).
   * O telefone exibido e o do JSON-LD derivam do mesmo número.
   */
  whatsapp: '5500000000000',
  /** Perfil fictício (ADR-009): exibido como texto, sem link clicável. */
  instagramHandle: '@cobrevelho.ficticia',
  email: 'contato@cobrevelho.example',
  privacyEmail: 'privacidade@cobrevelho.example',
  timezone: 'America/Sao_Paulo' as const,
  about: {
    paragraphs: [
      'A Cobre Velho nasceu da ideia de que cortar cabelo é um ofício: tesoura afiada, navalha quente e tempo para conversar sem pressa.',
      'Aqui o atendimento é sempre com hora marcada. Você escolhe o serviço, o barbeiro e o horário, e chega na hora em que combinamos.',
    ],
    highlights: [
      { value: '12 anos*', label: 'de ofício' },
      { value: '3', label: 'barbeiros' },
      { value: '100%', label: 'com hora marcada' },
    ],
    footnote: '* Dados fictícios, apenas para demonstração.',
  },
  services: [
    {
      slug: 'corte-classico',
      name: 'Corte clássico',
      description: 'Tesoura e máquina, acabamento na navalha e finalização com pomada.',
      durationMin: 30,
      priceCents: 4500,
    },
    {
      slug: 'corte-degrade',
      name: 'Corte degradê',
      description: 'Degradê com transição suave, do baixo ao alto, no estilo que você escolher.',
      durationMin: 45,
      priceCents: 5500,
    },
    {
      slug: 'barba-na-navalha',
      name: 'Barba na navalha',
      description: 'Toalha quente, óleo pré-barba, navalha e hidratação pós-barba.',
      durationMin: 30,
      priceCents: 3500,
    },
    {
      slug: 'corte-e-barba',
      name: 'Corte + barba',
      description: 'O combo completo: corte clássico e barba na navalha em uma única visita.',
      durationMin: 60,
      priceCents: 7000,
    },
    {
      slug: 'pezinho',
      name: 'Pezinho e acabamento',
      description: 'Contorno de nuca, costeletas e linha da testa para manter o corte em dia.',
      durationMin: 15,
      priceCents: 1500,
    },
    {
      slug: 'sobrancelha',
      name: 'Sobrancelha na navalha',
      description: 'Limpeza e alinhamento discreto, sem exageros.',
      durationMin: 15,
      priceCents: 1500,
    },
  ] satisfies Service[],
  barbers: [
    {
      slug: 'rafael-quintao',
      name: 'Rafael Quintão',
      bio: 'Mestre do corte clássico e da tesoura. Aprendeu o ofício com o avô.',
      specialties: ['Corte clássico', 'Tesoura'],
      photo: 'barbers/rafael-quintao.svg',
    },
    {
      slug: 'dandara-veloso',
      name: 'Dandara Veloso',
      bio: 'Especialista em degradê e cabelos cacheados, com olho para o detalhe.',
      specialties: ['Degradê', 'Cabelo cacheado'],
      photo: 'barbers/dandara-veloso.svg',
    },
    {
      slug: 'iago-mendonca',
      name: 'Iago Mendonça',
      bio: 'Barba na navalha e toalha quente: a calma de quem não tem pressa.',
      specialties: ['Barba na navalha', 'Corte + barba'],
      photo: 'barbers/iago-mendonca.svg',
    },
  ] satisfies Barber[],
  openingHours: [
    { weekday: 1, open: '09:00', close: '19:00' },
    { weekday: 2, open: '09:00', close: '19:00' },
    { weekday: 3, open: '09:00', close: '19:00' },
    { weekday: 4, open: '09:00', close: '19:00' },
    { weekday: 5, open: '09:00', close: '19:00' },
    { weekday: 6, open: '09:00', close: '17:00' },
  ] satisfies OpeningHours[],
  /** Imagens ilustrativas (placeholders). `file` é relativo a src/assets; extensão ignorada. */
  images: {
    hero: {
      file: 'hero/hero.svg',
      alt: 'Ilustração de poste de barbeiro, tesoura e navalha em tons de cobre sobre fundo escuro.',
    },
    about: {
      file: 'about/about.svg',
      alt: 'Ilustração de pincel de barba, navalha e espuma sobre fundo escuro.',
    },
    gallery: [
      { file: 'gallery/tesoura.svg', alt: 'Ilustração de uma tesoura de corte aberta.' },
      { file: 'gallery/navalha.svg', alt: 'Ilustração de uma navalha de barbeiro.' },
      { file: 'gallery/pente.svg', alt: 'Ilustração de um pente de barbeiro.' },
      { file: 'gallery/poste.svg', alt: 'Ilustração de um poste de barbeiro listrado.' },
      { file: 'gallery/pincel.svg', alt: 'Ilustração de um pincel de barba com espuma.' },
      { file: 'gallery/cadeira.svg', alt: 'Ilustração de uma cadeira de barbearia.' },
    ] satisfies GalleryItem[],
  },
};

export type Business = typeof business;
