/**
 * Multi-Key Store — extra API keys per provider, AI Modules, and API Groups.
 *
 * All data lives in the shared `app_settings` table so every user/device sees
 * the same configuration, matching how primary keys in `ai_config` behave.
 *
 * ─── Concepts ────────────────────────────────────────────────────────────────
 *
 *  ExtraKey   – a spare API key for a provider (key pool / round-robin)
 *  ApiGroup   – a named group of keys for one provider (e.g. "Production Keys",
 *               "Free Tier Pool"). Each group can hold up to MAX_KEYS_PER_GROUP
 *               keys and falls back internally before escalating.
 *  AIModule   – a named usage profile (e.g. "Legal Drafting", "Case Research").
 *               Each module independently picks which provider+model to use and
 *               which ApiGroup to draw keys from.  The active module is what
 *               the AI Agent uses for all requests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '@/integrations/supabase/client';
import type { AIProvider } from './ai-providers';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Total keys allowed per provider (primary + spares). */
export const MAX_KEYS_PER_PROVIDER = 6;
/** Spares on top of the primary. */
export const MAX_EXTRA_KEYS = MAX_KEYS_PER_PROVIDER - 1;
/** Max keys inside a single API Group. */
export const MAX_KEYS_PER_GROUP = 6;
/** Max API Groups per provider. */
export const MAX_GROUPS_PER_PROVIDER = 10;
/** Max AI Modules. */
export const MAX_MODULES = 20;

const SETTINGS_KEY     = 'ai_extra_keys';
const GROUPS_KEY       = 'ai_api_groups';
const MODULES_KEY      = 'ai_modules';
const LEGACY_STORAGE_KEY = 'lawmind_extra_api_keys';

// ── Types ─────────────────────────────────────────────────────────────────────

const PROVIDERS: AIProvider[] = ['groq', 'openai', 'gemini', 'openrouter', 'custom'];

export interface ExtraKey {
  id:      string;
  key:     string;
  label:   string;
  addedAt: string;
}

export type ExtraKeysMap = Record<AIProvider, ExtraKey[]>;

/** A single key entry inside an API Group. */
export interface GroupKey {
  id:      string;
  key:     string;
  label:   string;
  addedAt: string;
}

/** A named group of API keys for one provider. */
export interface ApiGroup {
  id:       string;
  name:     string;
  provider: AIProvider;
  keys:     GroupKey[];
  /** Optional notes (e.g. "Paid plan, 40 RPM") */
  notes?:   string;
  createdAt: string;
}

/** A named AI usage profile / module. */
export interface AIModule {
  id:           string;
  name:         string;
  description?: string;
  provider:     AIProvider;
  model:        string;
  /** ID of the ApiGroup to draw keys from (undefined = use the primary key pool). */
  groupId?:     string;
  /** Fallback provider if primary fails. */
  fallbackProvider?: AIProvider;
  fallbackModel?:    string;
  fallbackGroupId?:  string;
  createdAt:    string;
  updatedAt:    string;
}

// ── In-memory caches ──────────────────────────────────────────────────────────

function emptyMap(): ExtraKeysMap {
  return { groq: [], openai: [], gemini: [], openrouter: [], custom: [] };
}

let cache:        ExtraKeysMap = emptyMap();
let groupsCache:  ApiGroup[]   = [];
let modulesCache: AIModule[]   = [];

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalise(raw: unknown): ExtraKeysMap {
  const out = emptyMap();
  if (!raw || typeof raw !== 'object') return out;
  for (const p of PROVIDERS) {
    const list = (raw as Record<string, unknown>)[p];
    if (Array.isArray(list)) {
      out[p] = list
        .filter((k): k is ExtraKey => !!k && typeof (k as ExtraKey).key === 'string')
        .slice(0, MAX_EXTRA_KEYS);
    }
  }
  return out;
}

function normaliseGroups(raw: unknown): ApiGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (g): g is ApiGroup =>
      !!g &&
      typeof g.id === 'string' &&
      typeof g.name === 'string' &&
      PROVIDERS.includes(g.provider) &&
      Array.isArray(g.keys),
  );
}

function normaliseModules(raw: unknown): AIModule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is AIModule =>
      !!m &&
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      PROVIDERS.includes(m.provider),
  );
}

// ── ExtraKeys (legacy per-provider key pool) ──────────────────────────────────

export function getCachedKeys():  ExtraKeysMap { return cache;        }
export function setCachedKeys(m: ExtraKeysMap) { cache = normalise(m); }
export function getExtraKeys(provider: AIProvider): ExtraKey[] { return cache[provider] || []; }

export function getAllKeysForProvider(provider: AIProvider, primaryKey: string): string[] {
  const keys = [primaryKey, ...getExtraKeys(provider).map((e) => e.key)].filter(Boolean);
  return [...new Set(keys)].slice(0, MAX_KEYS_PER_PROVIDER);
}

export function getTotalExtraKeys(): number {
  return Object.values(cache).reduce((sum, l) => sum + l.length, 0);
}

// ── API Groups ────────────────────────────────────────────────────────────────

export function getCachedGroups(): ApiGroup[] { return groupsCache; }

export function getGroupsByProvider(provider: AIProvider): ApiGroup[] {
  return groupsCache.filter((g) => g.provider === provider);
}

export function getGroupById(id: string): ApiGroup | undefined {
  return groupsCache.find((g) => g.id === id);
}

/** All keys from a group as plain strings, for the failover chain. */
export function getKeysFromGroup(groupId: string): string[] {
  const group = getGroupById(groupId);
  if (!group) return [];
  return group.keys.map((k) => k.key).filter(Boolean);
}

// ── AI Modules ────────────────────────────────────────────────────────────────

export function getCachedModules(): AIModule[] { return modulesCache; }

export function getModuleById(id: string): AIModule | undefined {
  return modulesCache.find((m) => m.id === id);
}

// ── Persistence helpers ───────────────────────────────────────────────────────

async function fetchSetting<T>(key: string): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) { console.warn(`[multiKeyStore] Could not load ${key}:`, error.message); return null; }
  return data?.value ?? null;
}

async function saveSetting(key: string, value: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

// ── Load all ──────────────────────────────────────────────────────────────────

function readLegacyLocalKeys(): ExtraKeysMap | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = normalise(JSON.parse(raw));
    return Object.values(parsed).some((l) => l.length > 0) ? parsed : null;
  } catch { return null; }
}

export async function fetchExtraKeys(): Promise<ExtraKeysMap> {
  const raw = await fetchSetting<unknown>(SETTINGS_KEY);
  let map = normalise(raw);

  if (!raw && Object.values(map).every((l) => l.length === 0)) {
    const legacy = readLegacyLocalKeys();
    if (legacy) {
      map = legacy;
      await persistExtraKeys(map);
      try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
    }
  }
  cache = map;
  return map;
}

export async function fetchApiGroups(): Promise<ApiGroup[]> {
  const raw = await fetchSetting<unknown>(GROUPS_KEY);
  groupsCache = normaliseGroups(raw);
  return groupsCache;
}

export async function fetchAIModules(): Promise<AIModule[]> {
  const raw = await fetchSetting<unknown>(MODULES_KEY);
  modulesCache = normaliseModules(raw);
  return modulesCache;
}

/** Fetch everything at once — call this from useAIConfig on mount. */
export async function fetchAllStoreData(): Promise<{
  extraKeys: ExtraKeysMap;
  groups: ApiGroup[];
  modules: AIModule[];
}> {
  const [extraKeys, groups, modules] = await Promise.all([
    fetchExtraKeys(),
    fetchApiGroups(),
    fetchAIModules(),
  ]);
  return { extraKeys, groups, modules };
}

// ── Persist helpers ───────────────────────────────────────────────────────────

export async function persistExtraKeys(map: ExtraKeysMap): Promise<void> {
  const value = normalise(map);
  await saveSetting(SETTINGS_KEY, value);
  cache = value;
}

export async function persistApiGroups(groups: ApiGroup[]): Promise<void> {
  await saveSetting(GROUPS_KEY, groups);
  groupsCache = groups;
}

export async function persistAIModules(modules: AIModule[]): Promise<void> {
  await saveSetting(MODULES_KEY, modules);
  modulesCache = modules;
}

// ── ExtraKey CRUD ─────────────────────────────────────────────────────────────

export class KeyLimitError extends Error {}

export async function addExtraKey(
  provider: AIProvider,
  key: string,
  label?: string,
): Promise<ExtraKeysMap> {
  const map = { ...cache, [provider]: [...(cache[provider] || [])] };
  if (map[provider].length >= MAX_EXTRA_KEYS) {
    throw new KeyLimitError(
      `${provider} already has the maximum of ${MAX_KEYS_PER_PROVIDER} keys.`,
    );
  }
  if (map[provider].some((k) => k.key === key)) {
    throw new Error('That key is already in the pool.');
  }
  map[provider].push({
    id: crypto.randomUUID(),
    key,
    label: label || `${provider} key #${map[provider].length + 2}`,
    addedAt: new Date().toISOString(),
  });
  await persistExtraKeys(map);
  return cache;
}

export async function removeExtraKey(provider: AIProvider, id: string): Promise<ExtraKeysMap> {
  const map = { ...cache, [provider]: (cache[provider] || []).filter((k) => k.id !== id) };
  await persistExtraKeys(map);
  return cache;
}

// ── ApiGroup CRUD ─────────────────────────────────────────────────────────────

export async function createApiGroup(
  provider: AIProvider,
  name: string,
  notes?: string,
): Promise<ApiGroup> {
  const existing = groupsCache.filter((g) => g.provider === provider);
  if (existing.length >= MAX_GROUPS_PER_PROVIDER) {
    throw new Error(`Maximum ${MAX_GROUPS_PER_PROVIDER} groups per provider.`);
  }
  const group: ApiGroup = {
    id: crypto.randomUUID(),
    name,
    provider,
    keys: [],
    notes,
    createdAt: new Date().toISOString(),
  };
  const updated = [...groupsCache, group];
  await persistApiGroups(updated);
  return group;
}

export async function updateApiGroup(
  id: string,
  patch: Partial<Pick<ApiGroup, 'name' | 'notes'>>,
): Promise<ApiGroup[]> {
  const updated = groupsCache.map((g) => g.id === id ? { ...g, ...patch } : g);
  await persistApiGroups(updated);
  return groupsCache;
}

export async function deleteApiGroup(id: string): Promise<ApiGroup[]> {
  const updated = groupsCache.filter((g) => g.id !== id);
  await persistApiGroups(updated);
  // Unlink any module that referenced this group
  const updatedModules = modulesCache.map((m) => ({
    ...m,
    groupId:         m.groupId         === id ? undefined : m.groupId,
    fallbackGroupId: m.fallbackGroupId === id ? undefined : m.fallbackGroupId,
  }));
  await persistAIModules(updatedModules);
  return groupsCache;
}

export async function addKeyToGroup(
  groupId: string,
  key: string,
  label?: string,
): Promise<ApiGroup[]> {
  const group = groupsCache.find((g) => g.id === groupId);
  if (!group) throw new Error('Group not found.');
  if (group.keys.length >= MAX_KEYS_PER_GROUP) {
    throw new Error(`Group is full (max ${MAX_KEYS_PER_GROUP} keys).`);
  }
  if (group.keys.some((k) => k.key === key)) {
    throw new Error('That key is already in this group.');
  }
  const newKey: GroupKey = {
    id: crypto.randomUUID(),
    key,
    label: label || `Key #${group.keys.length + 1}`,
    addedAt: new Date().toISOString(),
  };
  const updated = groupsCache.map((g) =>
    g.id === groupId ? { ...g, keys: [...g.keys, newKey] } : g,
  );
  await persistApiGroups(updated);
  return groupsCache;
}

export async function removeKeyFromGroup(
  groupId: string,
  keyId: string,
): Promise<ApiGroup[]> {
  const updated = groupsCache.map((g) =>
    g.id === groupId ? { ...g, keys: g.keys.filter((k) => k.id !== keyId) } : g,
  );
  await persistApiGroups(updated);
  return groupsCache;
}

// ── AIModule CRUD ─────────────────────────────────────────────────────────────

export async function createAIModule(
  name: string,
  provider: AIProvider,
  model: string,
  opts?: {
    description?: string;
    groupId?: string;
    fallbackProvider?: AIProvider;
    fallbackModel?: string;
    fallbackGroupId?: string;
  },
): Promise<AIModule> {
  if (modulesCache.length >= MAX_MODULES) {
    throw new Error(`Maximum ${MAX_MODULES} modules reached.`);
  }
  const now = new Date().toISOString();
  const mod: AIModule = {
    id:           crypto.randomUUID(),
    name,
    description:  opts?.description,
    provider,
    model,
    groupId:      opts?.groupId,
    fallbackProvider: opts?.fallbackProvider,
    fallbackModel:    opts?.fallbackModel,
    fallbackGroupId:  opts?.fallbackGroupId,
    createdAt:    now,
    updatedAt:    now,
  };
  const updated = [...modulesCache, mod];
  await persistAIModules(updated);
  return mod;
}

export async function updateAIModule(
  id: string,
  patch: Partial<Omit<AIModule, 'id' | 'createdAt'>>,
): Promise<AIModule[]> {
  const updated = modulesCache.map((m) =>
    m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m,
  );
  await persistAIModules(updated);
  return modulesCache;
}

export async function deleteAIModule(id: string): Promise<AIModule[]> {
  const updated = modulesCache.filter((m) => m.id !== id);
  await persistAIModules(updated);
  return modulesCache;
}
