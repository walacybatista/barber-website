import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import { mapErrorToAction } from '../lib/action-errors.ts';
import { logError } from '../lib/log.ts';
import { normalizeClientIp } from '../lib/client-ip.ts';
import { login as loginService } from '../lib/auth/login.ts';
import { consumeRateLimit } from '../lib/rate-limit.ts';
import { createHash } from 'node:crypto';
import {
  SESSION_COOKIE,
  deleteSession,
  sessionCookieDeleteOptions,
  sessionCookieOptions,
  validateSession,
} from '../lib/auth/sessions.ts';
import {
  cancelBooking,
  createBooking,
  createTimeBlock,
  deleteTimeBlock,
  listAvailability,
  markBookingStatus,
  rescheduleBooking,
} from '../lib/booking/repository.ts';
import { normalizePhone } from '../lib/booking/rules.ts';
import { isAdminDateInRange, localToUtc } from '../lib/time/tz.ts';

/** Fronteira HTTP fina: valida (zod), chama lib/ e traduz erros de domínio. */
function toActionError(err: unknown): never {
  if (err instanceof ActionError) throw err;
  throw new ActionError(mapErrorToAction(err) as ConstructorParameters<typeof ActionError>[0]);
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
    logError('requireAdmin: falha ao carregar sessão', err);
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

/** IP do cliente (IPv6 -> /64); sem `clientAddress` agrupa tudo em 'unknown' (limite mais rígido, não mais frouxo). */
function clientIp(context: ActionAPIContext): string {
  try {
    return normalizeClientIp(context.clientAddress);
  } catch {
    return 'unknown';
  }
}

const BOOKING_MAX_PER_IP = 10;
const QUARTER_HOUR = /^([01]\d|2[0-3]):(00|15|30|45)$/;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoInstant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const barberIdOrNull = z.number().int().positive().max(2147483647).nullable().optional();

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
      serviceId: z.number().int().positive().max(2147483647),
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
      serviceId: z.number({ error: 'Escolha um serviço.' }).int().positive().max(2147483647),
      barberId: z.number().int().positive().max(2147483647).nullable(),
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
        return { ok: true };
      } catch (err) {
        logError('logout: falha ao apagar sessão', err);
        throw new ActionError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Serviço temporariamente indisponível. Tente novamente.',
        });
      } finally {
        context.cookies.delete(SESSION_COOKIE, sessionCookieDeleteOptions());
      }
    },
  }),

  // accept: 'form': /admin e /admin/bloqueios/novo postam FormData (sem JS). Data/hora locais
  // (America/Sao_Paulo) viram instantes UTC no handler. Vazio chega como null.
  createTimeBlock: defineAction({
    accept: 'form',
    input: z
      .object({
        barberId: z.number({ error: 'Escolha o barbeiro.' }).int().positive().max(2147483647),
        date: z
          .string({ error: 'Informe a data.' })
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.')
          .refine(isAdminDateInRange, 'Data fora do intervalo permitido (2000 a 2100).'),
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
      try {
        const admin = await requireAdmin(context);
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
    input: z.object({ blockId: z.number().int().positive().max(2147483647) }),
    handler: async ({ blockId }, context) => {
      try {
        await requireAdmin(context);
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
      bookingId: z.number().int().positive().max(2147483647),
      status: z.enum(['cancelled', 'completed', 'no_show']),
    }),
    handler: async ({ bookingId, status }, context) => {
      try {
        await requireAdmin(context);
        return summary(await markBookingStatus(getDb(), bookingId, status));
      } catch (err) {
        return toActionError(err);
      }
    },
  }),
};
