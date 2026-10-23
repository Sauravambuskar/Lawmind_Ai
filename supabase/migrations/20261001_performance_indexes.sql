-- Indexes for the filters and sort orders used by the application.
-- All statements are idempotent and do not change application behaviour.

CREATE INDEX IF NOT EXISTS cases_created_at_idx ON public.cases (created_at DESC);
CREATE INDEX IF NOT EXISTS cases_status_created_idx ON public.cases (status, created_at DESC);
CREATE INDEX IF NOT EXISTS cases_client_created_idx ON public.cases (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cases_advocate_created_idx ON public.cases (advocate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hearings_date_idx ON public.hearings (hearing_date);
CREATE INDEX IF NOT EXISTS hearings_case_date_idx ON public.hearings (case_id, hearing_date DESC);
CREATE INDEX IF NOT EXISTS hearings_status_date_idx ON public.hearings (status, hearing_date);

CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON public.invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_client_created_idx ON public.invoices (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_case_created_idx ON public.invoices (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON public.invoices (status, due_date);

CREATE INDEX IF NOT EXISTS payments_invoice_date_idx ON public.payments (invoice_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_date_idx ON public.payments (payment_date DESC);

CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_case_date_idx ON public.expenses (case_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS documents_case_created_idx ON public.documents (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evidence_case_created_idx ON public.evidence (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_case_created_idx ON public.notes (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_client_created_idx ON public.notes (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS advice_case_created_idx ON public.advice (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS advice_client_created_idx ON public.advice (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clients_created_at_idx ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS advocates_created_at_idx ON public.advocates (created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON public.contacts (created_at DESC);

CREATE INDEX IF NOT EXISTS tasks_status_due_idx ON public.tasks (status, due_date);
CREATE INDEX IF NOT EXISTS tasks_assigned_status_idx ON public.tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS tasks_case_created_idx ON public.tasks (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_created_idx ON public.audit_logs (table_name, created_at DESC);

ANALYZE public.cases;
ANALYZE public.hearings;
ANALYZE public.invoices;
ANALYZE public.payments;
ANALYZE public.expenses;
ANALYZE public.documents;
ANALYZE public.evidence;
ANALYZE public.notes;
ANALYZE public.advice;
ANALYZE public.tasks;
