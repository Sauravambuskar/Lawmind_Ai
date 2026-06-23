import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AIProvider } from '@/lib/ai-providers';

export interface ProviderEntry {
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AIConfig {
  providers: Record<AIProvider, ProviderEntry>;
  activeProvider: AIProvider;
}

const DEFAULT_CONFIG: AIConfig = {
  providers: {
    groq: { apiKey: '', model: 'llama-3.3-70b-versatile', enabled: false },
    openai: { apiKey: '', model: 'gpt-4o-mini', enabled: false },
    gemini: { apiKey: '', model: 'gemini-2.0-flash', enabled: false },
    custom: { apiKey: '', model: '', baseUrl: '', enabled: false },
  },
  activeProvider: 'groq',
};

/**
 * Loads AI config from Supabase `ai_config` table.
 * Super Admin / Admin can write; all authenticated users can read.
 */
export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Guard: skip realtime reloads while we are saving
  const isSavingRef = useRef(false);
  // Debounce timer per provider
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Accumulate pending DB updates per provider so nothing gets lost
  const pendingUpdatesRef = useRef<Record<string, Record<string, unknown>>>({});

  // ── Fetch config from Supabase ──
  const loadConfig = useCallback(async () => {
    // Don't overwrite local state while a save is in progress
    if (isSavingRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('ai_config')
      .select('provider, api_key, model, base_url, is_active')
      .order('provider');

    if (error || !data) {
      console.warn('[useAIConfig] Could not load from Supabase, using defaults', error?.message);
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
          model: String(row.model || ''),
          baseUrl: String(row.base_url || ''),
          enabled: apiKey.length > 0,
        };
      }
      if (row.is_active) activeProvider = p;
    }

    setConfig({ providers, activeProvider });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();

    // Real-time subscription — fires for OTHER users' changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel('ai_config_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_config' },
        () => {
          if (!isSavingRef.current) {
            loadConfig();
          }
        },
      )
      .subscribe();

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
    };
  }, [loadConfig]);

  // ── Flush a single provider's accumulated updates to DB ──
  const flushProvider = useCallback(async (provider: AIProvider) => {
    const pending = pendingUpdatesRef.current[provider];
    if (!pending || Object.keys(pending).length === 0) return;

    // Copy and clear the pending set
    const dbUpdates = { ...pending, updated_at: new Date().toISOString() };
    pendingUpdatesRef.current[provider] = {};

    isSavingRef.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('ai_config')
      .update(dbUpdates)
      .eq('provider', provider);

    if (error) {
      console.error('[useAIConfig] Failed to save:', error.message);
      toast.error(`Failed to save AI config: ${error.message}`);
    }

    // Keep the guard up for a short window so the realtime event passes
    setTimeout(() => { isSavingRef.current = false; }, 2000);
  }, []);

  // ── Update a single provider field (debounced, accumulated) ──
  const updateProvider = useCallback(
    (provider: AIProvider, updates: Partial<ProviderEntry>) => {
      // 1. Instant local state update for responsive UI
      setConfig((prev) => ({
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: { ...prev.providers[provider], ...updates },
        },
      }));

      // 2. Block realtime reloads
      isSavingRef.current = true;

      // 3. Accumulate updates (merge with any pending ones)
      if (!pendingUpdatesRef.current[provider]) {
        pendingUpdatesRef.current[provider] = {};
      }
      const pending = pendingUpdatesRef.current[provider];
      if (updates.apiKey !== undefined) pending.api_key = updates.apiKey;
      if (updates.model !== undefined) pending.model = updates.model;
      if (updates.baseUrl !== undefined) pending.base_url = updates.baseUrl;

      // 4. Debounce: reset timer for this provider
      if (saveTimersRef.current[provider]) {
        clearTimeout(saveTimersRef.current[provider]);
      }
      saveTimersRef.current[provider] = setTimeout(() => {
        flushProvider(provider);
      }, 1000);
    },
    [flushProvider],
  );

  // ── Set one provider as active, deactivate others ──
  const setActiveProvider = useCallback(async (provider: AIProvider) => {
    setConfig((prev) => ({ ...prev, activeProvider: provider }));
    isSavingRef.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawClient = supabase as any;
    await rawClient
      .from('ai_config')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .neq('provider', '__none__');

    await rawClient
      .from('ai_config')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('provider', provider);

    setTimeout(() => { isSavingRef.current = false; }, 2000);
  }, []);

  // ── Build the provider config object needed by ai-providers.ts ──
  const getActiveConfig = useCallback(() => {
    const entry = config.providers[config.activeProvider];
    return {
      provider: config.activeProvider,
      apiKey: entry.apiKey,
      model: entry.model,
      baseUrl: entry.baseUrl,
      name: config.activeProvider,
    };
  }, [config]);

  const hasActiveKey = config.providers[config.activeProvider]?.apiKey?.length > 0;

  return { config, loading, updateProvider, setActiveProvider, getActiveConfig, hasActiveKey };
}
