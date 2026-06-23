export type AIProvider = 'groq' | 'openai' | 'gemini' | 'custom';

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
  return sendOpenAICompatible(config, messages);
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
