-- Task progress tracking, assignment history and the privileges that control them.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. Progress + assignment columns on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_progress_range') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_progress_range CHECK (progress BETWEEN 0 AND 100);
  END IF;
END
$$;

-- Existing finished tasks count as 100% so case progress is right from day one.
UPDATE public.tasks
SET progress = 100,
    completed_at = COALESCE(completed_at, updated_at, created_at, now())
WHERE status = 'done' AND progress <> 100;

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_case_id_idx ON public.tasks (case_id);

-- 2. Activity log: every progress update, status change, assignment and comment
CREATE TABLE IF NOT EXISTS public.task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('created', 'progress', 'status', 'assigned', 'unassigned', 'comment')),
  note text,
  progress integer,
  status text,
  assignee uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_updates_task_idx ON public.task_updates (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_updates_case_idx ON public.task_updates (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_updates_created_idx ON public.task_updates (created_at DESC);

ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_updates_all" ON public.task_updates;
CREATE POLICY "task_updates_all" ON public.task_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Admins get the new privileges by default (super admins always have everything).
--    Other roles / members get them only when ticked in Permissions or on the member.
DO $$
DECLARE
  col_type text;
  priv text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'sections';

  FOREACH priv IN ARRAY ARRAY['task-assign', 'task-dashboard'] LOOP
    IF col_type = 'jsonb' THEN
      UPDATE public.role_permissions
      SET sections = sections || to_jsonb(ARRAY[priv])
      WHERE role = 'admin' AND NOT sections ? priv;
    ELSIF col_type = 'ARRAY' THEN
      UPDATE public.role_permissions
      SET sections = array_append(sections, priv)
      WHERE role = 'admin' AND NOT (priv = ANY(sections));
    END IF;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
