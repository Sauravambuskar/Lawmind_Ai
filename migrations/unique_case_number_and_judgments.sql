-- ════════════════════════════════════════════════════════════
-- 1. Unique constraint on cases.case_number
-- ════════════════════════════════════════════════════════════
CREATE UNIQUE INDEX IF NOT EXISTS cases_case_number_unique ON public.cases(case_number);

-- ════════════════════════════════════════════════════════════
-- 2. Related Judgments table
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.case_judgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  title text NOT NULL,
  citation text,
  court text,
  year text,
  summary text,
  url text,
  relevance text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.case_judgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "case_judgments_all" ON public.case_judgments;
CREATE POLICY "case_judgments_all" ON public.case_judgments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- 3. Hearing Reminders table
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hearing_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_number text,
  title text NOT NULL,
  hearing_date date NOT NULL,
  remind_days_before integer NOT NULL DEFAULT 1,
  reminded_at timestamptz,
  is_dismissed boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hearing_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hearing_reminders_all" ON public.hearing_reminders;
CREATE POLICY "hearing_reminders_all" ON public.hearing_reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
