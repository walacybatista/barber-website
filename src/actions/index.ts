import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import { InvalidCredentialsError, login as loginService } from '../lib/auth/login.ts';
import { RateLimitedError, consumeRateLimit } from '../lib/rate-limit.ts';
import { createHash } from 'node:crypto';
import {
  SESSION_COOKIE,
  deleteSession,
  sessionCookieOptions,
  validateSession,
} from '../lib/auth/sessions.ts';
import { DomainError, InvalidStateError } from '../lib/booking/errors.ts';
import {
  cancelBooking,
  createBooking,
  createTimeBlock,
  deleteTimeBlock,
  getBookingByToken,
  listAvailability,
  markBookingStatus,
  rescheduleBooking,
} from '../lib/booking/repository.ts';
import { normalizePhone } from '../lib/booking/rules.ts';
import { isValidLocalDate, localToUtc } from '../lib/time/tz.ts';

/** Fronteira HTTP fina: valida (zod), chama lib/ e traduz erros de domínio. */
function toActionError(err: unknown): never {
  if (err instanceof ActionError) throw err;
  if (err instanceof RateLimitedError) {
    throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: err.message });
  }
  if (err instanceof InvalidCredentialsError) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: err.message });
  }
  // Barbeiro inativo (reagendar): código próprio, para a página não confundir com "horário reservado".
  if (err instanceof InvalidStateError && 'reason' in err && err.reason === 'BARBER_UNAVAILABLE') {
    throw new ActionError({ code: 'PRECONDITION_FAILED', message: err.message });
  }
  if (err instanceof DomainError) {
    const code =
      err.code === 'TOO_MANY_BOOKINGS'
        ? 'TOO_MANY_REQUESTS'
        : err.code === 'SLOT_TAKEN' || err.code === 'INVALID_STATE'
          ? 'CONFLICT'
          : err.code === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : err.code === 'TOO_LATE'
              ? 'FORBIDDEN'
              : 'BAD_REQUEST';
    throw new ActionError({ code, message: err.message });
  }
  throw err;
}

/**
 * Revalida a sessão no servidor (não confia só no middleware). Falha do banco vira 503
 * (SERVICE_UNAVAILABLE) genérico, sem stack. Nas Actions admin o Astro valida o `input` (zod)
 * antes do handler: é inevitável e aceitável (só parse, sem acesso a dados); o handler chama
 * `requireAdmin` antes de qualquer outro trabalho.
 */
async function requireAdmin(context: ActionAPIContext) {
  const sid = context.cookies.get(SESSION_COOKIE)?.value;
  let session;
  try {
    session = await validateSession(getDb(), sid);
  } catch (err) {
    console.error('requireAdmin: falha ao carregar sessão', err instanceof Error ? err.name : err);
    throw new ActionError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço temporariamente indisponível. Tente novamente.',
    });
  }
  if (!session) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' });
  }
  return session.user;
}

/** IP do cliente; sem `clientAddress` agrupa tudo em 'unknown' (limite fica mais rígido, não mais frouxo). */
function clientIp(context: ActionAPIContext): string {
  try {
    return context.clientAddress;
  } catch {
    return 'unknown';
  }
}

const BOOKING_MAX_PER_IP = 10;
const QUARTER_HOUR = /^([01]\d|2[0-3]):(00|15|30|45)$/;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoInstant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const barberIdOrNull = z.number().int().positive().nullable().optional();

// Aceita "(11) 91234-5678": remove a máscara aqui (a Action é a fronteira; normalizePhone valida DDD/tamanho).
const phone = z
  .string({ error: 'Informe um telefone com DDD.' })
  .max(30, 'Telefone inválido.')
  .transform((v, ctx) => {
    const n = normalizePhone(v.replace(/\D/g, ''));
    if (!n) ctx.issues.push({ code: 'custom', message: 'Informe um telefone com DDD.', input: v });
    return n ?? '';
  });

const summary = (b: { id: number; startAt: Date; endAt: Date; status: string }) => ({
  id: b.id,
  startAt: b.startAt.toISOString(),
  endAt: b.endAt.toISOString(),
  status: b.status,
});

export const server = {
  getAvailability: defineAction({
    input: z.object({
      date: localDate,
      serviceId: z.number().int().positive(),
      barberId: barberIdOrNull,
    }),
    handler: async (input) => {
      try {
        const slots = await listAvailability(getDb(), input);
        return slots.map((s) => ({ start: s.start.toISOString(), barberIds: s.barberIds }));
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  // accept: 'form' (ADR-010): o fluxo /agendar posta FormData e funciona sem JavaScript.
  // Campos ausentes/vazios chegam como null (barberId vazio = "sem preferência"); checkbox marcado = 'on'.
  createBooking: defineAction({
    accept: 'form',
    input: z.object({
      serviceId: z.number({ error: 'Escolha um serviço.' }).int().positive(),
      barberId: z.number().int().positive().nullable(),
      startAt: z.iso
        .datetime({ offset: true, error: 'Escolha um horário.' })
        .transform((s) => new Date(s)),
      customerName: z
        .string({ error: 'Informe seu nome.' })
        .trim()
        .min(2, 'Informe seu nome (mínimo 2 letras).')
        .max(80, 'Nome muito longo (máximo 80 caracteres).'),
      customerPhone: phone,
      consent: z
        .literal('on', { error: 'Para agendar, precisamos do seu consentimento.' })
        .transform(() => true as const),
    }),
    handler: async (input, context) => {
      try {
        // Rate limit por IP (10/hora) antes de tocar no domínio; conta toda tentativa.
        await consumeRateLimit(getDb(), [
          {
            key: `booking:ip:${createHash('sha256').update(clientIp(context)).digest('hex')}`,
            max: BOOKING_MAX_PER_IP,
            windowMs: 60 * 60 * 1000,
          },
        ]);
        const { booking, token } = await createBooking(getDb(), input);
        return { booking: summary(booking), barberId: booking.barberId, manageToken: token };
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  // accept: 'form' (ADR-010): páginas /agendamento/[token] postam FormData (token em campo hidden).
  cancelBooking: defineAction({
    accept: 'form',
    input: z.object({ token: z.string().min(20).max(100) }),
    handler: async ({ token }) => {
      try {
        return summary(await cancelBooking(getDb(), token));
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  rescheduleBooking: defineAction({
    accept: 'form',
    input: z.object({ token: z.string().min(20).max(100), startAt: isoInstant }),
    handler: async ({ token, startAt }) => {
      try {
        return summary(await rescheduleBooking(getDb(), token, startAt));
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  // ---- Admin ----

  login: defineAction({
    accept: 'form',
    input: z.object({ username: z.string().min(1).max(60), password: z.string().min(1).max(200) }),
    handler: async (input, context) => {
      const ip = clientIp(context);
      try {
        const s = await loginService(getDb(), { ...input, ip });
        context.cookies.set(
          SESSION_COOKIE,
          s.sessionId,
          sessionCookieOptions(s.expiresAt, import.meta.env.PROD),
        );
        return { username: s.user.username };
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  logout: defineAction({
    accept: 'form',
    handler: async (_input, context) => {
      try {
        await deleteSession(getDb(), context.cookies.get(SESSION_COOKIE)?.value);
      } catch (err) {
        console.error('logout: falha ao apagar sessão', err instanceof Error ? err.message : err);
        throw new ActionError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Serviço temporariamente indisponível. Tente novamente.',
        });
      } finally {
        context.cookies.delete(SESSION_COOKIE, { path: '/' });
      }
      return { ok: true };
    },
  }),

  // accept: 'form': /admin e /admin/bloqueios/novo postam FormData (sem JS). Data/hora locais
  // (America/Sao_Paulo) viram instantes UTC no handler. Vazio chega como null.
  createTimeBlock: defineAction({
    accept: 'form',
    input: z
      .object({
        barberId: z.number({ error: 'Escolha o barbeiro.' }).int().positive(),
        date: z
          .string({ error: 'Informe a data.' })
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.')
          .refine(isValidLocalDate, 'Data inválida.'),
        startTime: z
          .string({ error: 'Informe o início.' })
          .regex(QUARTER_HOUR, 'Use horários de 15 em 15 minutos.'),
        endTime: z
          .string({ error: 'Informe o fim.' })
          .regex(QUARTER_HOUR, 'Use horários de 15 em 15 minutos.'),
        reason: z
          .string()
          .trim()
          .max(120, 'Motivo muito longo (máximo 120 caracteres).')
          .nullable(),
      })
      .refine((v) => v.endTime > v.startTime, {
        path: ['endTime'],
        message: 'O fim deve ser depois do início.',
      }),
    handler: async (input, context) => {
      const admin = await requireAdmin(context);
      try {
        const b = await createTimeBlock(getDb(), {
          barberId: input.barberId,
          startAt: localToUtc(input.date, input.startTime),
          endAt: localToUtc(input.date, input.endTime),
          reason: input.reason ?? '',
          createdBy: admin.id,
        });
        return { id: b.id };
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  deleteTimeBlock: defineAction({
    accept: 'form',
    input: z.object({ blockId: z.number().int().positive() }),
    handler: async ({ blockId }, context) => {
      await requireAdmin(context);
      try {
        await deleteTimeBlock(getDb(), blockId);
        return { ok: true };
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  setBookingStatus: defineAction({
    accept: 'form',
    input: z.object({
      bookingId: z.number().int().positive(),
      status: z.enum(['cancelled', 'completed', 'no_show']),
    }),
    handler: async ({ bookingId, status }, context) => {
      await requireAdmin(context);
      try {
        return summary(await markBookingStatus(getDb(), bookingId, status));
      } catch (err) {
        return toActionError(err);
      }
    },
  }),

  /** Para a página /agendamento/[token] também poderia chamar a lib direto; exposto por conveniência. */
  getBooking: defineAction({
    input: z.object({ token: z.string().min(20).max(100) }),
    handler: async ({ token }) => {
      const b = await getBookingByToken(getDb(), token);
      if (!b) throw new ActionError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado.' });
      return {
        ...b,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
      };
    },
  }),
};
