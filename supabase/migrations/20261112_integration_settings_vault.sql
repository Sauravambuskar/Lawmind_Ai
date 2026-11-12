-- Server-only integration configuration. RLS is enabled with no client policy;
-- only the service role used by Vercel functions can read or write these values.

CREATE TABLE IF NOT EXISTS public.integration_settings (
  id text PRIMARY KEY DEFAULT 'system',
  r2_account_id text,
  r2_access_key_id text,
  r2_secret_access_key text,
  r2_bucket_name text,
  ecourts_api_key text,
  ecourts_batch_size integer NOT NULL DEFAULT 10 CHECK (ecourts_batch_size BETWEEN 1 AND 20),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_settings_singleton CHECK (id = 'system')
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_settings'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.integration_settings', existing_policy.policyname);
  END LOOP;
END
$$;

REVOKE ALL ON public.integration_settings FROM anon, authenticated;
GRANT ALL ON public.integration_settings TO service_role;

INSERT INTO public.integration_settings (id)
VALUES ('system')
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
