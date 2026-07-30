/**
 * Multi-Key Store — stores extra API keys per provider for failover
 * Keys are stored in localStorage and used by the failover system.
 * 
 * When the primary key fails → system tries extra keys in order.
 */

import type { AIProvider } from "./ai-providers";

const STORAGE_KEY = "lawmind_extra_api_keys";

export interface ExtraKey {
  id: string;
  key: string;
  label: string; // e.g. "Groq Key #2"
  addedAt: string;
}

type ExtraKeysMap = Record<AIProvider, ExtraKey[]>;

function load(): ExtraKeysMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { groq: [], openai: [], gemini: [], openrouter: [], custom: [] };
}

function save(data: ExtraKeysMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Get all extra keys for a provider */
export function getExtraKeys(provider: AIProvider): ExtraKey[] {
  return load()[provider] || [];
}

/** Add an extra key */
export function addExtraKey(provider: AIProvider, key: string, label?: string): void {
  const data = load();
  if (!data[provider]) data[provider] = [];
  data[provider].push({
    id: crypto.randomUUID(),
    key,
    label: label || `${provider} Key #${data[provider].length + 2}`,
    addedAt: new Date().toISOString(),
  });
  save(data);
}

/** Remove an extra key by id */
export function removeExtraKey(provider: AIProvider, id: string): void {
  const data = load();
  if (data[provider]) {
    data[provider] = data[provider].filter(k => k.id !== id);
    save(data);
  }
}

/** Get all keys for a provider (primary + extras) as API key strings */
export function getAllKeysForProvider(provider: AIProvider, primaryKey: string): string[] {
  const extras = getExtraKeys(provider);
  const keys = [primaryKey, ...extras.map(e => e.key)].filter(Boolean);
  return [...new Set(keys)]; // deduplicate
}

/** Get total count of all extra keys across all providers */
export function getTotalExtraKeys(): number {
  const data = load();
  return Object.values(data).reduce((sum, keys) => sum + keys.length, 0);
}
