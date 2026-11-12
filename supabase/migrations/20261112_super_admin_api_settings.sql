-- API settings remain readable by authenticated users because the current
-- browser-side AI and EmailJS clients consume them. Only Super Admins may write.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DO $$
DECLARE
  target_table text;
  existing_policy record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['ai_config', 'app_settings', 'email_settings']
  LOOP
    IF to_regclass('public.' || target_table) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, target_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY api_settings_read ON public.%I FOR SELECT TO authenticated USING (true)',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY api_settings_super_admin_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin())',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY api_settings_super_admin_update ON public.%I FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY api_settings_super_admin_delete ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin())',
      target_table
    );
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
