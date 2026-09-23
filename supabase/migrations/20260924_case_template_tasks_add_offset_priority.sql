-- CaseTemplatesPage reads, orders by, and writes days_offset and priority,
-- but the table was created without them, so every load/insert returned 400.
ALTER TABLE public.case_template_tasks
  ADD COLUMN IF NOT EXISTS days_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

NOTIFY pgrst, 'reload schema';
