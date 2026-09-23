import {
  configId,
  cooldownRemaining,
  classifyFailure,
  markFailure,
  markSuccess,
  nextRotation,
  FAILURE_LABEL,
  formatRemaining,
  type FailureKind,
} from './aiFailover';

export type AIProvider = 'groq' | 'openai' | 'gemini' | 'openrouter' | 'custom';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  name: string;
}

export interface SendOptions {
  /** Per-attempt budget in ms. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Caller's cancellation signal (e.g. user navigated away). */
  signal?: AbortSignal;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed?: number;
}

export const PROVIDER_INFO: Record<AIProvider, {
  label: string;
  baseUrl: string;
  models: { id: string; name: string }[];
  color: string;
  description: string;
}> = {
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      // Standard text models (active as of Sep 2026)
      { id: 'llama-3.3-70b-versatile',                  name: 'Llama 3.3 70B Versatile — 131K ✅' },
      { id: 'llama-3.1-8b-instant',                     name: 'Llama 3.1 8B Instant — 131K (Fast)' },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B — 131K (New)' },
      { id: 'openai/gpt-oss-120b',                      name: 'GPT-OSS 120B — 131K' },
      { id: 'openai/gpt-oss-20b',                       name: 'GPT-OSS 20B — 131K (Budget)' },
      { id: 'moonshotai/kimi-k2-instruct-0905',         name: 'Kimi K2 Instruct — 131K (New)' },
      { id: 'qwen/qwen3.8-27b',                         name: 'Qwen 3.8 27B — 131K' },
      { id: 'qwen/qwen3.6-27b',                         name: 'Qwen 3.6 27B — 131K' },
      // Agentic / compound (uses tools, web search)
      { id: 'compound-beta',                            name: 'Groq Compound Beta — Agentic+Search' },
      { id: 'compound-beta-mini',                       name: 'Groq Compound Beta Mini — Agentic' },
    ],
    color: '#f55036',
    description: 'Ultra-fast inference — Llama 3.3 70B recommended for legal Q&A',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o',               name: 'GPT-4o' },
      { id: 'gpt-4o-mini',          name: 'GPT-4o Mini' },
      { id: 'gpt-4.1',              name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini',         name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano',         name: 'GPT-4.1 Nano (Fast)' },
      { id: 'o4-mini',              name: 'o4-mini (Reasoning)' },
      { id: 'o3-mini',              name: 'o3-mini (Reasoning)' },
    ],
    color: '#10a37f',
    description: 'Premium AI models by OpenAI',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.5-flash',      name: 'Gemini 2.5 Flash ✅' },
      { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash',      name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Fast)' },
      { id: 'gemini-1.5-flash',      name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro',        name: 'Gemini 1.5 Pro' },
    ],
    color: '#4285f4',
    description: 'Google multimodal AI — Gemini 2.5 Flash recommended',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      // Free models (as of Aug 2026)
      { id: 'nvidia/nemotron-3-super-120b-a12b:free',  name: 'NVIDIA Nemotron 120B (Free)' },
      { id: 'deepseek/deepseek-r2:free',               name: 'DeepSeek R2 (Free)' },
      { id: 'microsoft/phi-4-reasoning:free',          name: 'Phi-4 Reasoning (Free)' },
      { id: 'qwen/qwen3-30b-a3b:free',                 name: 'Qwen3 30B (Free)' },
      { id: 'qwen/qwen3-235b-a22b:free',               name: 'Qwen3 235B (Free)' },
      { id: 'google/gemini-2.5-flash:free',            name: 'Gemini 2.5 Flash (Free)' },
      { id: 'google/gemini-2.0-flash-exp:free',        name: 'Gemini 2.0 Flash Exp (Free)' },
      // Paid models
      { id: 'anthropic/claude-sonnet-4',               name: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-3.5-sonnet',             name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o',                           name: 'GPT-4o (via OpenRouter)' },
      { id: 'deepseek/deepseek-chat',                  name: 'DeepSeek Chat (Cheap)' },
      { id: 'meta-llama/llama-3.3-70b-instruct',       name: 'Llama 3.3 70B' },
    ],
    color: '#6366f1',
    description: 'Access 400+ models — includes free tier, no credit card for free models',
  },
  custom: {
    label: 'Custom',
    baseUrl: '',
    models: [],
    color: '#a855f7',
    description: 'Any OpenAI-compatible API endpoint',
  },
};

export function getProviderModels(provider: AIProvider) {
  return PROVIDER_INFO[provider]?.models ?? [];
}

/** Error that carries enough detail for the failover chain to react correctly. */
export class AIError extends Error {
  status?: number;
  kind: FailureKind;
  retryAfterMs?: number;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.kind = classifyFailure(status, message);
  }
}

/** Default per-attempt budget. Long enough for a full legal draft. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** Reads Retry-After (seconds, or an HTTP date) into milliseconds. */
function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;

  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);

  const at = Date.parse(raw);
  if (!Number.isNaN(at)) return Math.max(0, at - Date.now());

  return undefined;
}

/**
 * fetch with a hard timeout, and the caller's own abort signal respected.
 * Without this a hung provider stalls the whole failover chain indefinitely.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onOuterAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onOuterAbort);

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err: unknown) {
    // Caller cancelled — propagate as-is so callers can tell it apart.
    if (signal?.aborted) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new AIError(err instanceof Error ? err.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

async function sendOpenAICompatible(
  config: AIProviderConfig,
  messages: AIMessage[],
  opts: SendOptions = {},
): Promise<AIResponse> {
  const baseUrl =
    config.provider === 'custom'
      ? config.baseUrl
      : PROVIDER_INFO[config.provider].baseUrl;

  const res = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.signal,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new AIError(
      err.error?.message || `API Error: ${res.status}`,
      res.status,
      parseRetryAfter(res),
    );
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: config.model,
    provider: config.provider,
    tokensUsed: data.usage?.total_tokens,
  };
}

async function sendGeminiMessage(
  config: AIProviderConfig,
  messages: AIMessage[],
  opts: SendOptions = {},
): Promise<AIResponse> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetchWithTimeout(
    `${PROVIDER_INFO.gemini.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemMsg
          ? { parts: [{ text: systemMsg.content }] }
          : undefined,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.signal,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new AIError(
      err.error?.message || `Gemini Error: ${res.status}`,
      res.status,
      parseRetryAfter(res),
    );
  }

  const data = await res.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model: config.model,
    provider: 'gemini',
    tokensUsed: data.usageMetadata?.totalTokenCount,
  };
}

export async function sendAIMessage(
  config: AIProviderConfig,
  messages: AIMessage[],
  opts: SendOptions = {},
): Promise<AIResponse> {
  if (config.provider === 'gemini') {
    return sendGeminiMessage(config, messages, opts);
  }
  // groq, openai, openrouter, custom — all OpenAI-compatible
  return sendOpenAICompatible(config, messages, opts);
}

export interface FailoverAttempt {
  name: string;
  provider: AIProvider;
  model: string;
  kind: FailureKind;
  message: string;
}

export interface FailoverResponse extends AIResponse {
  /** Which config actually answered, e.g. "groq #2". */
  servedBy: string;
  /** How far down the chain we had to go (1 = the primary worked). */
  attemptNumber: number;
  /** Everything that failed on the way, in order. */
  attempts: FailoverAttempt[];
  /** Legacy shape kept so existing callers keep working. */
  failedProviders?: string[];
}

export interface FailoverOptions extends SendOptions {
  /** Retry the same key once on a transient provider blip before moving on. */
  retryTransient?: boolean;
  /** Called after each failure, for live UI feedback. */
  onAttemptFailed?: (attempt: FailoverAttempt, next?: string) => void;
}

/** Transient = worth one immediate retry on the same key. */
const TRANSIENT: FailureKind[] = ['server', 'timeout', 'network'];

/**
 * Round-robin each provider's own keys while keeping provider priority.
 *
 * Groups stay in their original order — the active provider is still tried
 * before the others — but which of that provider's keys goes first advances
 * on every request. Six Groq keys then share the load six ways instead of
 * key #1 absorbing all of it and the rest idling as cold spares.
 */
function rotateWithinProviders(
  configs: AIProviderConfig[],
  offset: number,
): AIProviderConfig[] {
  const groups = new Map<AIProvider, AIProviderConfig[]>();
  for (const c of configs) {
    const group = groups.get(c.provider) ?? [];
    group.push(c);
    groups.set(c.provider, group);
  }

  const out: AIProviderConfig[] = [];
  for (const group of groups.values()) {
    const start = group.length > 1 ? offset % group.length : 0;
    for (let i = 0; i < group.length; i++) {
      out.push(group[(start + i) % group.length]);
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Multi-provider / multi-key failover.
 *
 * Order of business for each config in priority order:
 *   1. Skip it if it is in cooldown from an earlier failure.
 *   2. Try it. On a transient blip, retry once after a short backoff.
 *   3. On failure, put it in cooldown (honouring Retry-After) and move on.
 *
 * If every config is cooling down we do not give up — the one that recovers
 * soonest is tried anyway, since a cooldown is an estimate, not a fact.
 */
export async function sendAIMessageWithFailover(
  configs: AIProviderConfig[],
  messages: AIMessage[],
  opts: FailoverOptions = {},
): Promise<FailoverResponse> {
  const usable = configs.filter((c) => c.apiKey);

  if (usable.length === 0) {
    throw new Error('No AI provider is configured. Add an API key in AI Settings.');
  }

  const attempts: FailoverAttempt[] = [];

  const ready = usable.filter((c) => cooldownRemaining(configId(c)) === 0);
  // Everything is sidelined — fall back to whichever recovers soonest.
  const queue =
    ready.length > 0
      ? rotateWithinProviders(ready, nextRotation())
      : [...usable].sort((a, b) => cooldownRemaining(configId(a)) - cooldownRemaining(configId(b))).slice(0, 1);

  for (let i = 0; i < queue.length; i++) {
    const config = queue[i];
    const id = configId(config);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await sendAIMessage(config, messages, opts);
        markSuccess(id);
        return {
          ...response,
          servedBy: config.name,
          attemptNumber: attempts.length + 1,
          attempts,
          failedProviders: attempts.length
            ? attempts.map((a) => `${a.name}: ${a.message}`)
            : undefined,
        };
      } catch (error: unknown) {
        // Caller cancelled — not a provider failure, don't burn the chain.
        if (opts.signal?.aborted) throw error;

        const message = error instanceof Error ? error.message : 'Unknown error';
        const status = error instanceof AIError ? error.status : undefined;
        const kind = error instanceof AIError ? error.kind : classifyFailure(status, message);
        const retryAfterMs = error instanceof AIError ? error.retryAfterMs : undefined;

        const isTransient = TRANSIENT.includes(kind);
        const canRetrySameKey = (opts.retryTransient ?? true) && isTransient && attempt === 0;

        if (canRetrySameKey) {
          await sleep(1000);
          continue; // one more go at the same key
        }

        const record: FailoverAttempt = {
          name: config.name,
          provider: config.provider,
          model: config.model,
          kind,
          message,
        };
        attempts.push(record);
        markFailure(id, kind, message, retryAfterMs);
        opts.onAttemptFailed?.(record, queue[i + 1]?.name);
        break; // move to the next config
      }
    }
  }

  // Everything in the chain failed — report it in a form a human can act on.
  const detail = attempts
    .map((a) => `  • ${a.name} (${a.model}) — ${FAILURE_LABEL[a.kind]}: ${a.message}`)
    .join('\n');

  const soonest = usable
    .map((c) => cooldownRemaining(configId(c)))
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)[0];

  const hint = soonest
    ? ` Next key frees up in about ${formatRemaining(soonest)}.`
    : ' Add another API key in AI Settings so requests can fall back.';

  throw new Error(
    `All ${attempts.length} AI provider${attempts.length === 1 ? '' : 's'} failed.${hint}\n${detail}`,
  );
}

/**
 * Returns null on success, or an error message string on failure.
 */
export async function testConnection(config: AIProviderConfig): Promise<string | null> {
  try {
    const result = await sendAIMessage(
      config,
      [
        { role: 'system', content: 'You are a test assistant. Be brief.' },
        { role: 'user', content: 'Reply with just the word OK.' },
      ],
      { timeoutMs: 20_000 },
    );
    // A passing test proves the key works — lift any cooldown it was under.
    markSuccess(configId(config));
    return result.content.length > 0 ? null : 'Empty response from API';
  } catch (err: unknown) {
    if (err instanceof Error) return err.message;
    return 'Unknown connection error';
  }
}
