import type { APIRoute } from 'astro';
import { business } from '@/data/business';
import { getDb } from '@/db/client';
import { getBookingByToken } from '@/lib/booking/repository';
import { buildIcs } from '@/lib/ics';
import { logError } from '@/lib/log';

export const prerender = false;

const privateHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

export const GET: APIRoute = async ({ params }) => {
  const token = params.token ?? '';
  const notFound = () =>
    new Response('Agendamento não encontrado.', {
      status: 404,
      headers: { ...privateHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return notFound();

  let booking;
  try {
    booking = await getBookingByToken(getDb(), token);
  } catch (err) {
    logError('[agendamento.ics] falha ao buscar agendamento', err);
    return new Response('Serviço indisponível. Tente de novo em instantes.', {
      status: 503,
      headers: {
        ...privateHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '30',
      },
    });
  }
  if (!booking || booking.status !== 'confirmed') return notFound();

  const a = business.address;
  const body = buildIcs({
    uid: `booking-${booking.id}@cobrevelho.example`,
    start: booking.startAt,
    end: booking.endAt,
    summary: `${booking.service.name} — ${business.shortName}`,
    location: `${business.name}, ${a.street}, ${a.neighborhood}, ${a.city} - ${a.region}`,
    description: `Barbeiro: ${booking.barber.name}. Barbearia fictícia (projeto de portfólio).`,
  });
  return new Response(body, {
    headers: {
      ...privateHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="agendamento-cobre-velho.ics"',
    },
  });
};
