const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos (inteiro seguro) como moeda brasileira (ex.: 2500 -> "R$ 25,00"). */
export function formatBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatBRL: valor inválido: ${cents}`);
  }
  return brl.format(cents / 100);
}
