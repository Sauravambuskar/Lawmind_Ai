-- Schema alignment migration
--
-- Context: the app UI collected several fields that had no matching column, and
-- PostgREST could not resolve embedded selects (clients(name), cases(title), ...)
-- because no foreign keys were ever declared. Both problems silently produced
-- empty pages or failed inserts.
--
-- All statements are additive and idempotent. No data is modified or dropped.
-- Verified before running: zero orphaned rows on every relation below, so the
-- FK constraints validate without touching existing data (3634 cases preserved).

-- ─────────────────────────────────────────────────────────────
-- 1. Missing nullable columns the UI already collects
-- ─────────────────────────────────────────────────────────────

-- Per-user section override for RBAC. NULL => inherit role_permissions.
alter table public.profiles add column if not exists sections jsonb;

-- Payment reference / UTR captured by the Record Payment dialog.
alter table public.payments add column if not exists reference_no text;

-- Document description shown in the Documents grid and Notice Maker.
alter table public.documents add column if not exists description text;

-- Expense fields present in the Expenses form.
alter table public.expenses add column if not exists description text;
alter table public.expenses add column if not exists category text;
alter table public.expenses add column if not exists receipt_url text;

-- ─────────────────────────────────────────────────────────────
-- 2. Foreign keys so PostgREST can resolve embedded selects
--    ON DELETE SET NULL — deleting a parent must not cascade away child records.
-- ─────────────────────────────────────────────────────────────

do $$
declare
  rel record;
begin
  for rel in
    select * from (values
      ('cases',              'client_id',       'clients'),
      ('cases',              'advocate_id',     'advocates'),
      ('invoices',           'client_id',       'clients'),
      ('invoices',           'case_id',         'cases'),
      ('payments',           'invoice_id',      'invoices'),
      ('payments',           'client_id',       'clients'),
      ('expenses',           'case_id',         'cases'),
      ('expenses',           'client_id',       'clients'),
      ('expenses',           'expense_type_id', 'expense_types'),
      ('hearings',           'case_id',         'cases'),
      ('documents',          'case_id',         'cases'),
      ('documents',          'client_id',       'clients'),
      ('tasks',              'case_id',         'cases'),
      ('notes',              'case_id',         'cases'),
      ('evidence',           'case_id',         'cases'),
      ('advice',             'client_id',       'clients'),
      ('case_judgments',     'case_id',         'cases'),
      ('hearing_reminders',  'case_id',         'cases')
    ) as t(child, col, parent)
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = rel.child || '_' || rel.col || '_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete set null',
        rel.child, rel.child || '_' || rel.col || '_fkey', rel.col, rel.parent
      );
    end if;
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Force PostgREST to pick up the new columns and relationships.
--    Without this, embedded selects keep failing against a stale cache.
-- ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
