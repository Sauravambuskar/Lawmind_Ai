-- Per-case SMS recipients: parties, advocates, admins (each with a phone).
-- Automatic hearing/status SMS go to every contact here with notify = true,
-- plus the case's linked client. Managed from the case detail "Recipients" tab.

CREATE TABLE IF NOT EXISTS public.case_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL DEFAULT 'party',   -- party | advocate | admin | other
  notify boolean NOT NULL DEFAULT true,  -- include in automatic SMS
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_contacts_case_id_idx ON public.case_contacts (case_id);

ALTER TABLE public.case_contacts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'case_contacts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.case_contacts', existing_policy.policyname);
  END LOOP;
END
$$;

-- Signed-in staff manage case contacts (same access model as the case data itself).
CREATE POLICY case_contacts_read ON public.case_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY case_contacts_insert ON public.case_contacts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY case_contacts_update ON public.case_contacts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY case_contacts_delete ON public.case_contacts
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_contacts TO authenticated;
GRANT ALL ON public.case_contacts TO service_role;

NOTIFY pgrst, 'reload schema';
