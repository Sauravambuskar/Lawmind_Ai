import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AppSettings {
  autofillEnabled: boolean;
}

const QUERY_KEY = ['app_settings'];

async function fetchSettings(): Promise<AppSettings> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('app_settings')
    .select('key, value');

  if (error || !data) return { autofillEnabled: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[]).find((r) => r.key === 'ai_autofill');
  return { autofillEnabled: row?.value?.enabled ?? false };
}

async function saveAutofill(enabled: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('app_settings')
    .upsert(
      { key: 'ai_autofill', value: { enabled }, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

  if (error) throw new Error(error.message);
}

export function useAppSettings() {
  const queryClient = useQueryClient();

  const { data: settings = { autofillEnabled: false }, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 1000 * 60 * 5, // cache 5 min
  });

  const mutation = useMutation({
    mutationFn: saveAutofill,
    onMutate: async (enabled) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<AppSettings>(QUERY_KEY);
      queryClient.setQueryData<AppSettings>(QUERY_KEY, { autofillEnabled: enabled });
      return { prev };
    },
    onError: (_err, _enabled, ctx) => {
      queryClient.setQueryData(QUERY_KEY, ctx?.prev);
      toast.error('Failed to save autofill setting');
    },
    onSuccess: (_, enabled) => {
      toast.success(`AI Autofill ${enabled ? 'enabled' : 'disabled'} for all users`);
    },
  });

  return {
    settings,
    loading: isLoading,
    setAutofill: (enabled: boolean) => mutation.mutate(enabled),
    isSaving: mutation.isPending,
  };
}
