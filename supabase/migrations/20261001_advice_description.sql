-- AdvicePage reads and writes this field. The production table predates it.
ALTER TABLE public.advice
  ADD COLUMN IF NOT EXISTS description text;

NOTIFY pgrst, 'reload schema';
