-- Default / notification SMS number. A single controlled number that can either
-- receive a COPY of every SMS the system sends, or have ALL SMS ROUTED to it
-- only (useful during rollout/testing so real clients are not messaged yet).
-- Lives in the server-only integration_settings vault.
--
--   sms_default_mode:
--     'off'   - normal: SMS go only to their real recipients (default)
--     'copy'  - every SMS also sends a copy to sms_default_number
--     'route' - every SMS goes ONLY to sms_default_number (overrides recipients)

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS sms_default_number text,
  ADD COLUMN IF NOT EXISTS sms_default_mode text NOT NULL DEFAULT 'off';

NOTIFY pgrst, 'reload schema';
