-- Fast2SMS (DLT) integration: server-only credentials, DLT-approved templates,
-- and a delivery log. Mirrors the existing integration_settings vault + RLS
-- patterns (see 20261112_integration_settings_vault.sql and
-- 20261112_super_admin_api_settings.sql). This migration is self-contained: it
-- creates the integration_settings vault and the is_super_admin() helper if the
-- earlier migrations were never applied to this database.

-- 0a) The server-only secrets vault (created here if the R2/eCourts migration
--     was never run). RLS is on with no client policy — only the service role
--     used by the Vercel functions can read or write.
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
REVOKE ALL ON public.integration_settings FROM anon, authenticated;
GRANT ALL ON public.integration_settings TO service_role;
INSERT INTO public.integration_settings (id) VALUES ('system') ON CONFLICT (id) DO NOTHING;

-- 0b) Super Admin check used by the template policies below. Created here if the
--     super_admin_api_settings migration was never run.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 1) SMS credentials, added to the vault. The API key is stored encrypted by
--    the Vercel functions; browsers never read it.
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS fast2sms_api_key text,
  ADD COLUMN IF NOT EXISTS fast2sms_sender_id text,
  ADD COLUMN IF NOT EXISTS fast2sms_enabled boolean NOT NULL DEFAULT false,
  -- Master switch for ALL automatic (event-triggered) SMS. When false, manual
  -- sends still work but no auto-trigger ever fires, regardless of per-template
  -- auto_send flags.
  ADD COLUMN IF NOT EXISTS fast2sms_auto_send boolean NOT NULL DEFAULT false;

-- 2) DLT-approved SMS templates. Readable by any authenticated staff member so
--    the Custom SMS center can list them; only Super Admins may change them.
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'service',
  message_id text NOT NULL,                         -- Fast2SMS numeric DLT Message ID
  sender_id text,                                   -- optional per-template header; else the global one
  body text NOT NULL,                               -- preview text with {1},{2}… markers
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,     -- ordered: [{ "key": "...", "label": "..." }]
  auto_send boolean NOT NULL DEFAULT false,         -- opt-in: fire automatically on its trigger event
  trigger_event text,                               -- hearing_created | case_status_changed | advocate_assigned | client_onboarded
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Delivery log. Authenticated staff can read history; rows are written by the
--    server-side send function using the service role.
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text,
  message_id text,
  sender_id text,
  to_number text NOT NULL,
  variables_values text,
  rendered_message text,
  status text NOT NULL DEFAULT 'queued',            -- sent | failed | queued | skipped
  request_id text,
  error_msg text,
  trigger_source text,                              -- manual | auto:<event>
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_logs_created_at_idx ON public.sms_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS sms_logs_template_key_idx ON public.sms_logs (template_key);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('sms_templates', 'sms_logs')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',
      existing_policy.policyname, existing_policy.tablename);
  END LOOP;
END
$$;

-- Templates: all authenticated staff read; only Super Admins write.
CREATE POLICY sms_templates_read ON public.sms_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sms_templates_super_admin_insert ON public.sms_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY sms_templates_super_admin_update ON public.sms_templates
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY sms_templates_super_admin_delete ON public.sms_templates
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- Logs: authenticated staff read history. Inserts/updates come from the service
-- role (the sms-send function), which bypasses RLS, so no write policy is granted
-- to authenticated users.
CREATE POLICY sms_logs_read ON public.sms_logs
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.sms_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
GRANT ALL ON public.sms_logs TO service_role;

-- ---------------------------------------------------------------------------
-- Seed the four DLT-approved templates (sender header CORADV).
-- message_id values are the Fast2SMS numeric Message IDs from the DLT manager.
-- ---------------------------------------------------------------------------
INSERT INTO public.sms_templates
  (template_key, name, category, message_id, sender_id, body, variables, trigger_event, sort_order)
VALUES
  ('hearing_scheduled', 'Hearing Scheduled', 'service', '232319', 'CORADV',
   'Lawmind: Your hearing For Case No {1} is scheduled for {2} Kindly ensure your presence on time. For any query +91 9822239110 - Corelearn IT',
   '[{"key":"case_number","label":"Case Number"},{"key":"hearing_date","label":"Hearing Date"}]'::jsonb,
   'hearing_created', 10),
  ('case_status_update', 'Case Status Update', 'service', '232303', 'CORADV',
   'Lawmind: Your case No. {1} status has been updated . Please check the app for details. Corelearn IT',
   '[{"key":"case_number","label":"Case Number"}]'::jsonb,
   'case_status_changed', 20),
  ('advocate_assigned', 'Advocate Assigned', 'service', '232302', 'CORADV',
   'Lawmind: Your assigned advocate is {1}. Contact them for case-related assistance. Corelearn IT',
   '[{"key":"advocate_name","label":"Advocate Name"}]'::jsonb,
   'advocate_assigned', 30),
  ('client_onboarding', 'Client Onboarding', 'service', '232273', 'CORADV',
   'Welcome {1}! You are successfully onboarded with the Lawmind app. - Corelearn IT',
   '[{"key":"client_name","label":"Client Name"}]'::jsonb,
   'client_onboarded', 40)
ON CONFLICT (template_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
