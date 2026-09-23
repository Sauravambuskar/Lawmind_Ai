import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AIProvider } from '@/lib/ai-providers';
import {
  getAllKeysForProvider,
  fetchAllStoreData,
  addExtraKey,
  removeExtraKey,
  getCachedKeys,
  getCachedGroups,
  getCachedModules,
  getGroupById,
  getKeysFromGroup,
  createApiGroup,
  updateApiGroup,
  deleteApiGroup,
  addKeyToGroup,
  removeKeyFromGroup,
  createAIModule,
  updateAIModule,
  deleteAIModule,
  type ExtraKeysMap,
  type ApiGroup,
  type AIModule,
} from '@/lib/multiKeyStore';

export interface ProviderEntry {
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AIConfig {
  providers: Record<AIProvider, ProviderEntry>;
  activeProvider: AIProvider;
  /** ID of the active AI Module (undefined = default / no module). */
  activeModuleId?: string;
}

const DEFAULT_CONFIG: AIConfig = {
  providers: {
    groq:       { apiKey: '', model: 'llama-3.3-70b-versatile',                      enabled: false },
    openai:     { apiKey: '', model: 'gpt-4o-mini',                                enabled: false },
    gemini:     { apiKey: '', model: 'gemini-2.5-flash',                           enabled: false },
    openrouter: { apiKey: '', model: 'nvidia/nemotron-3-super-120b-a12b:free',     enabled: false },
    custom:     { apiKey: '', model: '', baseUrl: '',                              enabled: false },
  },
  activeProvider: 'groq',
};

// ─────────────────────────────────────────────────────────────────────────────

export function useAIConfig() {
  const [config, setConfig]       = useState<AIConfig>(DEFAULT_CONFIG);
  const [extraKeys, setExtraKeys] = useState<ExtraKeysMap>(getCachedKeys);
  const [groups,    setGroups]    = useState<ApiGroup[]>(getCachedGroups);
  const [modules,   setModules]   = useState<AIModule[]>(getCachedModules);
  const [loading,   setLoading]   = useState(true);

  const isSavingRef      = useRef(false);
  const saveTimersRef    = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingUpdatesRef = useRef<Record<string, Record<string, unknown>>>({});

  // ── Fetch from Supabase ────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (isSavingRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('ai_config')
      .select('provider, api_key, model, base_url, is_active')
      .order('provider');

    if (error || !data) {
      console.warn('[useAIConfig] Could not load from Supabase', error?.message);
      setLoading(false);
      return;
    }

    const providers = { ...DEFAULT_CONFIG.providers };
    let activeProvider: AIProvider = 'groq';

    for (const row of data as Record<string, unknown>[]) {
      const p = row.provider as AIProvider;
      if (providers[p]) {
        const apiKey = String(row.api_key || '');
        providers[p] = {
          apiKey,
          model:   String(row.model    || ''),
          baseUrl: String(row.base_url || ''),
          enabled: apiKey.length > 0,
        };
      }
      if (row.is_active) activeProvider = p as AIProvider;
    }

    setConfig((prev) => ({ ...prev, providers, activeProvider }));

    try {
      const { extraKeys: ek, groups: g, modules: m } = await fetchAllStoreData();
      setExtraKeys(ek);
      setGroups(g);
      setModules(m);
    } catch (err) {
      console.warn('[useAIConfig] Could not load store data', err);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel('ai_config_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_config' }, () => {
        if (!isSavingRef.current) loadConfig();
      })
      .subscribe();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (supabase as any).removeChannel(channel); };
  }, [loadConfig]);

  // ── Flush pending DB writes ────────────────────────────────────────────────
  const flushProvider = useCallback(async (provider: AIProvider) => {
    const pending = pendingUpdatesRef.current[provider];
    if (!pending || Object.keys(pending).length === 0) return;
    const dbUpdates = { ...pending, updated_at: new Date().toISOString() };
    pendingUpdatesRef.current[provider] = {};
    isSavingRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('ai_config').update(dbUpdates).eq('provider', provider);
    if (error) toast.error(`Failed to save AI config: ${error.message}`);
    setTimeout(() => { isSavingRef.current = false; }, 2000);
  }, []);

  const updateProvider = useCallback((provider: AIProvider, updates: Partial<ProviderEntry>) => {
    setConfig((prev) => ({
      ...prev,
      providers: { ...prev.providers, [provider]: { ...prev.providers[provider], ...updates } },
    }));
    isSavingRef.current = true;
    if (!pendingUpdatesRef.current[provider]) pendingUpdatesRef.current[provider] = {};
    const pending = pendingUpdatesRef.current[provider];
    if (updates.apiKey  !== undefined) pending.api_key  = updates.apiKey;
    if (updates.model   !== undefined) pending.model    = updates.model;
    if (updates.baseUrl !== undefined) pending.base_url = updates.baseUrl;
    if (saveTimersRef.current[provider]) clearTimeout(saveTimersRef.current[provider]);
    saveTimersRef.current[provider] = setTimeout(() => flushProvider(provider), 1000);
  }, [flushProvider]);

  const setActiveProvider = useCallback(async (provider: AIProvider) => {
    setConfig((prev) => ({ ...prev, activeProvider: provider }));
    isSavingRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = supabase as any;
    await raw.from('ai_config').update({ is_active: false, updated_at: new Date().toISOString() }).neq('provider', '__none__');
    await raw.from('ai_config').update({ is_active: true,  updated_at: new Date().toISOString() }).eq('provider', provider);
    setTimeout(() => { isSavingRef.current = false; }, 2000);
  }, []);

  // ── Active Module switching ────────────────────────────────────────────────
  const setActiveModule = useCallback((moduleId: string | undefined) => {
    setConfig((prev) => ({ ...prev, activeModuleId: moduleId }));
  }, []);

  // ── Failover chain builder ────────────────────────────────────────────────
  /**
   * Build the ordered list of configs the failover engine will walk.
   * Priority (top = first tried):
   *   1. Active module's group keys (if module + group configured)
   *   2. Active provider primary key + its extra-key pool
   *   3. Module's fallback provider keys (if configured)
   *   4. Every other enabled provider (their key pools), in configured order
   */
  const getAllConfigs = useCallback(() => {
    type Cfg = { provider: AIProvider; apiKey: string; model: string; baseUrl?: string; name: string };
    const configs: Cfg[] = [];
    const seen = new Set<string>();

    const push = (c: Cfg) => {
      if (!c.apiKey || seen.has(c.apiKey)) return;
      seen.add(c.apiKey);
      configs.push(c);
    };

    const activeModule = config.activeModuleId
      ? modules.find((m) => m.id === config.activeModuleId)
      : undefined;

    // ── 1. Module's primary group ──────────────────────────────────────────
    if (activeModule?.groupId) {
      const group = getGroupById(activeModule.groupId);
      if (group) {
        group.keys.forEach((k, i) => push({
          provider: group.provider,
          apiKey:   k.key,
          model:    activeModule.model,
          name:     `${activeModule.name} › ${group.name}${i > 0 ? ` #${i + 1}` : ''}`,
        }));
      }
    }

    // ── 2. Active provider key pool ────────────────────────────────────────
    const effectiveProvider = activeModule?.provider ?? config.activeProvider;
    const effectiveModel    = activeModule?.model    ?? config.providers[effectiveProvider]?.model;
    const primary = config.providers[effectiveProvider];
    if (primary?.apiKey) {
      getAllKeysForProvider(effectiveProvider, primary.apiKey).forEach((key, i) => push({
        provider: effectiveProvider,
        apiKey:   key,
        model:    effectiveModel,
        baseUrl:  primary.baseUrl,
        name:     `${effectiveProvider}${i > 0 ? ` #${i + 1}` : ''}`,
      }));
    }

    // ── 3. Module fallback provider ────────────────────────────────────────
    if (activeModule?.fallbackProvider) {
      const fbGroup = activeModule.fallbackGroupId
        ? getGroupById(activeModule.fallbackGroupId)
        : undefined;

      if (fbGroup) {
        fbGroup.keys.forEach((k, i) => push({
          provider: activeModule.fallbackProvider!,
          apiKey:   k.key,
          model:    activeModule.fallbackModel ?? config.providers[activeModule.fallbackProvider!]?.model ?? '',
          name:     `${activeModule.name} fallback › ${fbGroup.name}${i > 0 ? ` #${i + 1}` : ''}`,
        }));
      } else {
        const fbEntry = config.providers[activeModule.fallbackProvider];
        if (fbEntry?.apiKey) {
          getAllKeysForProvider(activeModule.fallbackProvider, fbEntry.apiKey).forEach((key, i) => push({
            provider: activeModule.fallbackProvider!,
            apiKey:   key,
            model:    activeModule.fallbackModel ?? fbEntry.model,
            baseUrl:  fbEntry.baseUrl,
            name:     `${activeModule.fallbackProvider} fallback${i > 0 ? ` #${i + 1}` : ''}`,
          }));
        }
      }
    }

    // ── 4. All other providers ─────────────────────────────────────────────
    const others: AIProvider[] = ['groq', 'openai', 'openrouter', 'gemini', 'custom'];
    others.filter((p) => p !== effectiveProvider && p !== activeModule?.fallbackProvider)
      .forEach((p) => {
        const entry = config.providers[p];
        if (entry?.apiKey) {
          getAllKeysForProvider(p, entry.apiKey).forEach((key, i) => push({
            provider: p,
            apiKey:   key,
            model:    entry.model,
            baseUrl:  entry.baseUrl,
            name:     `${p}${i > 0 ? ` #${i + 1}` : ''}`,
          }));
        }
      });

    return configs;
  }, [config, modules]);

  const getActiveConfig = useCallback(() => {
    const entry = config.providers[config.activeProvider];
    return { provider: config.activeProvider, apiKey: entry.apiKey, model: entry.model, baseUrl: entry.baseUrl, name: config.activeProvider };
  }, [config]);

  // ── ExtraKey pool ──────────────────────────────────────────────────────────
  const addKey    = useCallback(async (provider: AIProvider, key: string, label?: string) => {
    setExtraKeys(await addExtraKey(provider, key.trim(), label));
  }, []);
  const removeKey = useCallback(async (provider: AIProvider, id: string) => {
    setExtraKeys(await removeExtraKey(provider, id));
  }, []);

  // ── API Groups ─────────────────────────────────────────────────────────────
  const createGroup = useCallback(async (provider: AIProvider, name: string, notes?: string) => {
    await createApiGroup(provider, name, notes);
    setGroups([...getCachedGroups()]);
  }, []);

  const updateGroup = useCallback(async (id: string, patch: Partial<Pick<ApiGroup, 'name' | 'notes'>>) => {
    await updateApiGroup(id, patch);
    setGroups([...getCachedGroups()]);
  }, []);

  const deleteGroup = useCallback(async (id: string) => {
    await deleteApiGroup(id);
    setGroups([...getCachedGroups()]);
    setModules([...getCachedModules()]);
  }, []);

  const addGroupKey = useCallback(async (groupId: string, key: string, label?: string) => {
    await addKeyToGroup(groupId, key, label);
    setGroups([...getCachedGroups()]);
  }, []);

  const removeGroupKey = useCallback(async (groupId: string, keyId: string) => {
    await removeKeyFromGroup(groupId, keyId);
    setGroups([...getCachedGroups()]);
  }, []);

  // ── AI Modules ─────────────────────────────────────────────────────────────
  const createModule = useCallback(async (
    name: string, provider: AIProvider, model: string,
    opts?: Parameters<typeof createAIModule>[3],
  ) => {
    await createAIModule(name, provider, model, opts);
    setModules([...getCachedModules()]);
  }, []);

  const updateModule = useCallback(async (id: string, patch: Parameters<typeof updateAIModule>[1]) => {
    await updateAIModule(id, patch);
    setModules([...getCachedModules()]);
  }, []);

  const deleteModule = useCallback(async (id: string) => {
    await deleteAIModule(id);
    setModules([...getCachedModules()]);
    if (config.activeModuleId === id) setConfig((p) => ({ ...p, activeModuleId: undefined }));
  }, [config.activeModuleId]);

  const hasActiveKey = config.providers[config.activeProvider]?.apiKey?.length > 0;
  const totalConfiguredKeys = Object.values(config.providers).filter((p) => p.apiKey?.length > 0).length;

  return {
    // Core config
    config, loading,
    updateProvider, setActiveProvider, getActiveConfig, getAllConfigs,
    hasActiveKey, totalConfiguredKeys,
    // Extra key pool (per-provider, legacy)
    extraKeys, addKey, removeKey,
    // API Groups
    groups, createGroup, updateGroup, deleteGroup, addGroupKey, removeGroupKey,
    // AI Modules
    modules, setActiveModule, createModule, updateModule, deleteModule,
  };
}
