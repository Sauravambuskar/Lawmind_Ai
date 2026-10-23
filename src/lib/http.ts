const DEFAULT_TIMEOUT_MS = 15_000;

export interface RetryOptions {
  attempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
}

function abortError(): DOMException {
  return new DOMException("Request timed out", "AbortError");
}

/** Fetch with a hard timeout while preserving a caller-provided abort signal. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const outerSignal = init.signal;
  const onOuterAbort = () => controller.abort(outerSignal?.reason);

  if (outerSignal?.aborted) controller.abort(outerSignal.reason);
  else outerSignal?.addEventListener("abort", onOuterAbort, { once: true });

  const timeout = window.setTimeout(() => controller.abort(abortError()), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    outerSignal?.removeEventListener("abort", onOuterAbort);
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Retry safe reads only, and only for transient network/server failures. */
export async function fetchReadWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, options.attempts ?? 2);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseDelayMs = options.baseDelayMs ?? 250;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, { ...init, method: "GET" }, timeoutMs);
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!transient || attempt === attempts - 1) return response;
    } catch (error) {
      lastError = error;
      if (init.signal?.aborted || attempt === attempts - 1) throw error;
    }

    await wait(baseDelayMs * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}
