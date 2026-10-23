-- Restrict every currently-unprotected public table to authenticated users.
-- The application is already login-protected, so this closes anonymous API
-- access without changing any signed-in screen, role, option, or workflow.

DO $$
DECLARE
  table_record record;
  policy_exists boolean;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      table_record.schemaname,
      table_record.tablename
    );

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = table_record.schemaname
        AND tablename = table_record.tablename
        AND policyname = 'authenticated_full_access'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY authenticated_full_access ON %I.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        table_record.schemaname,
        table_record.tablename
      );
    END IF;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
