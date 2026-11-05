import { business } from '@/data/business';

/** Máximo de dígitos de um número internacional (E.164). */
const MAX_DIGITS = 15;

/** Remove tudo que não é dígito. Retorna o fallback se sobrar menos de 10 ou mais de 15 dígitos. */
export function normalizeWhatsappNumber(raw: string | undefined | null, fallback: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= MAX_DIGITS ? digits : fallback.replace(/\D/g, '');
}

/** Número efetivo do site (só dígitos): PUBLIC_WHATSAPP_NUMBER, embutido no build, ou o fictício. */
export function whatsappNumber(): string {
  return normalizeWhatsappNumber(
    import.meta.env.PUBLIC_WHATSAPP_NUMBER as string | undefined,
    business.whatsapp,
  );
}

/** Formata para exibição: 55DDNNNNNNNNN -> "+55 (DD) NNNNN-NNNN"; outros formatos -> "+dígitos". */
export function formatPhoneDisplay(digits: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`;
}

/** Monta o link `https://wa.me/<número>?text=<mensagem>`. */
export function buildWhatsappUrl(number: string, message?: string): string {
  const base = `https://wa.me/${number.replace(/\D/g, '')}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const DEFAULT_WHATSAPP_MESSAGE = 'Olá! Quero saber mais (projeto fictício).';

/** Link usado pelas páginas: número de whatsappNumber(). */
export function whatsappHref(message: string = DEFAULT_WHATSAPP_MESSAGE): string {
  return buildWhatsappUrl(whatsappNumber(), message);
}
