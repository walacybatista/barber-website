/** Log de erro sem PII: só nome e código de causa (ADR-011, S3). Nunca loga message/params (ex.: DrizzleQueryError traz SQL e parâmetros). */
export function logError(tag: string, err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err;
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  console.error(tag, cause ? `${name} (${String(cause)})` : name);
}
