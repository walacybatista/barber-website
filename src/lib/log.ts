/**
 * Erro de configuração com mensagem escrita por nós e sem segredo — seguro para log, e o operador
 * precisa lê-la (ex.: "DATABASE_URL não definida").
 */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Log de erro sem PII: só nome e código de causa (ADR-011, S3). Nunca loga message/params (ex.: DrizzleQueryError traz SQL e parâmetros) — exceto ConfigError, cuja mensagem é segura por construção. */
export function logError(tag: string, err: unknown): void {
  if (err instanceof ConfigError) {
    console.error(tag, `${err.name}: ${err.message}`);
    return;
  }
  const name = err instanceof Error ? err.name : typeof err;
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  console.error(tag, cause ? `${name} (${String(cause)})` : name);
}
