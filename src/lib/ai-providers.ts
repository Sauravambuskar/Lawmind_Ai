export type AIProvider = 'groq' | 'openai' | 'gemini' | 'openrouter' | 'custom';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  name: string;
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
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
      { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
      { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
      { id: 'compound-beta', name: 'Compound Beta (Agentic)' },
    ],
    color: '#f55036',
    description: 'Ultra-fast inference with open-source models',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    color: '#10a37f',
    description: 'Premium AI models by OpenAI',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
    color: '#4285f4',
    description: 'Google\'s multimodal AI models',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)' },
      { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini (Free)' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
    ],
    color: '#6366f1',
    description: 'Access 100+ AI models through one API key (free tier available)',
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

async function sendOpenAICompatible(
  config: AIProviderConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  const baseUrl =
    config.provider === 'custom'
      ? config.baseUrl
      : PROVIDER_INFO[config.provider].baseUrl;

  const res = await fetch(`${baseUrl}/chat/completions`, {
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
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `API Error: ${res.status}`);
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
): Promise<AIResponse> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
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
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `Gemini Error: ${res.status}`);
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
): Promise<AIResponse> {
  if (config.provider === 'gemini') {
    return sendGeminiMessage(config, messages);
  }
  // groq, openai, openrouter, custom — all OpenAI-compatible
  return sendOpenAICompatible(config, messages);
}

/**
 * Multi-key failover: tries primary config, if it fails (rate limit, quota, etc.)
 * automatically switches to next available provider/key.
 * 
 * Usage: sendAIMessageWithFailover(configs, messages)
 * configs = array of AIProviderConfig in priority order
 */
export async function sendAIMessageWithFailover(
  configs: AIProviderConfig[],
  messages: AIMessage[],
): Promise<AIResponse & { failedProviders?: string[] }> {
  const failedProviders: string[] = [];

  for (const config of configs) {
    if (!config.apiKey) continue; // Skip empty keys

    try {
      const response = await sendAIMessage(config, messages);
      return { ...response, failedProviders: failedProviders.length > 0 ? failedProviders : undefined };
    } catch (error: any) {
      const msg = error?.message || "";
      failedProviders.push(`${config.provider}(${config.model}): ${msg}`);

      // If it's a rate limit / quota error, try next provider
      const isRetryable = 
        msg.includes("429") || 
        msg.includes("rate") || 
        msg.includes("quota") || 
        msg.includes("limit") ||
        msg.includes("exceeded") ||
        msg.includes("capacity") ||
        msg.includes("overloaded") ||
        msg.includes("500") ||
        msg.includes("503") ||
        msg.includes("timeout");

      if (!isRetryable) {
        // Non-retryable error (e.g. invalid API key, bad request) — still try next
        continue;
      }
      // Retryable — try next config
      continue;
    }
  }

  // All providers failed
  throw new Error(
    `All AI providers failed:\n${failedProviders.join("\n")}`
  );
}

/**
 * Returns null on success, or an error message string on failure.
 */
export async function testConnection(config: AIProviderConfig): Promise<string | null> {
  try {
    const result = await sendAIMessage(config, [
      { role: 'system', content: 'You are a test assistant. Be brief.' },
      { role: 'user', content: 'Reply with just the word OK.' },
    ]);
    return result.content.length > 0 ? null : 'Empty response from API';
  } catch (err: unknown) {
    if (err instanceof Error) return err.message;
    return 'Unknown connection error';
  }
}
