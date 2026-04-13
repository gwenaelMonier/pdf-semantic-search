export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "LlmError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class LlmQuotaError extends LlmError {
  readonly retryAfterSeconds: number | null;
  constructor(message: string, retryAfterSeconds: number | null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmQuotaError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LlmTransientError extends LlmError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmTransientError";
  }
}

type RawSdkError = {
  status?: number;
  message?: string;
};

function parseRetryAfter(message: string | undefined): number | null {
  if (!message) return null;
  const match = message.match(/retry in ([\d.]+)s/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  return Number.isFinite(n) ? Math.ceil(n) : null;
}

export function normalizeLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  const raw = err as RawSdkError;
  const status = raw?.status;
  if (status === 429) {
    return new LlmQuotaError(raw.message ?? "Quota épuisé", parseRetryAfter(raw.message), {
      cause: err,
    });
  }
  if (typeof status === "number" && status >= 500 && status < 600) {
    return new LlmTransientError(raw.message ?? "Erreur transitoire", { cause: err });
  }
  return new LlmError(raw?.message ?? "Erreur LLM inconnue", { cause: err });
}
