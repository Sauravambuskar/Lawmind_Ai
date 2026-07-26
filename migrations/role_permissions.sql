-- Role Permissions table — stores which sections each role can access
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  sections jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_all" ON public.role_permissions;
CREATE POLICY "role_permissions_all" ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default permissions
INSERT INTO public.role_permissions (role, sections) VALUES
  ('super_admin', '["dashboard","today","staff","clients","advocates","advice","cases","hearings","evidence","invoices","documents","impdocs","notice-maker","quick-docs","expenses","contacts","notes","tasks","ai-agent","matters","tags","expense-types","templates","audit-logs","ai-settings","reports","permissions"]'),
  ('admin', '["dashboard","today","staff","clients","advocates","advice","cases","hearings","evidence","invoices","documents","impdocs","notice-maker","quick-docs","expenses","contacts","notes","tasks","ai-agent","matters","tags","expense-types","templates","audit-logs","ai-settings","reports","permissions"]'),
  ('agent', '["dashboard","today","clients","cases","hearings","tasks","documents","notes","contacts","expenses"]'),
  ('lawyer', '["dashboard","today","clients","advocates","cases","hearings","evidence","invoices","documents","impdocs","notice-maker","quick-docs","expenses","contacts","notes","tasks","ai-agent"]')
ON CONFLICT (role) DO NOTHING;
