-- Second batch of SMS templates: hearings, billing, documents and appointments.
-- Safe by default: inserted INACTIVE with a placeholder Message ID, so nothing
-- can be sent until a Super Admin pastes the real DLT Message ID (from the
-- Fast2SMS DLT Manager, after each template is APPROVED) and flips Active on,
-- in API Settings -> SMS delivery -> DLT Templates.
--
-- IMPORTANT: the wording below (including spacing/punctuation) must be
-- registered on the DLT portal EXACTLY as written here, with {#var#} in place
-- of each {1}, {2}, ... marker. Fast2SMS matches the approved template text
-- character-for-character; a mismatch returns "Invalid Template".

INSERT INTO public.sms_templates
  (template_key, name, category, message_id, sender_id, body, variables, trigger_event, active, sort_order)
VALUES
  ('hearing_reminder', 'Hearing Reminder', 'service', 'PENDING', 'CORADV',
   'Lawmind: Reminder - your hearing for Case No {1} is tomorrow, {2}. Please be present on time. - Corelearn IT',
   '[{"key":"case_number","label":"Case Number"},{"key":"hearing_date","label":"Hearing Date"}]'::jsonb,
   'hearing_reminder', false, 50),

  ('hearing_adjourned', 'Hearing Adjourned', 'service', 'PENDING', 'CORADV',
   'Lawmind: Hearing for Case No {1} is adjourned. Next date: {2}. - Corelearn IT',
   '[{"key":"case_number","label":"Case Number"},{"key":"next_hearing_date","label":"Next Hearing Date"}]'::jsonb,
   'hearing_adjourned', false, 60),

  ('case_disposed', 'Case Disposed', 'service', 'PENDING', 'CORADV',
   'Lawmind: Your Case No {1} has been disposed on {2}. Contact us for next steps. - Corelearn IT',
   '[{"key":"case_number","label":"Case Number"},{"key":"disposed_date","label":"Disposed Date"}]'::jsonb,
   'case_disposed', false, 70),

  ('invoice_generated', 'Invoice Generated', 'service', 'PENDING', 'CORADV',
   'Lawmind: Invoice {1} of Rs {2} for Case No {3} is generated. Due by {4}. - Corelearn IT',
   '[{"key":"invoice_number","label":"Invoice No"},{"key":"amount","label":"Amount"},{"key":"case_number","label":"Case Number"},{"key":"due_date","label":"Due Date"}]'::jsonb,
   'invoice_generated', false, 80),

  ('payment_received', 'Payment Received', 'service', 'PENDING', 'CORADV',
   'Lawmind: We have received Rs {1} against Invoice {2}. Thank you. - Corelearn IT',
   '[{"key":"amount","label":"Amount"},{"key":"invoice_number","label":"Invoice No"}]'::jsonb,
   'payment_received', false, 90),

  ('payment_reminder', 'Payment Reminder', 'service', 'PENDING', 'CORADV',
   'Lawmind: Gentle reminder - Invoice {1} of Rs {2} is due on {3}. Kindly clear it. - Corelearn IT',
   '[{"key":"invoice_number","label":"Invoice No"},{"key":"amount","label":"Amount"},{"key":"due_date","label":"Due Date"}]'::jsonb,
   'payment_reminder', false, 100),

  ('document_request', 'Document Request', 'service', 'PENDING', 'CORADV',
   'Lawmind: Please submit {1} for your Case No {2} by {3}. - Corelearn IT',
   '[{"key":"document_name","label":"Document Name"},{"key":"case_number","label":"Case Number"},{"key":"due_date","label":"Due Date"}]'::jsonb,
   'document_request', false, 110),

  ('appointment_scheduled', 'Appointment Scheduled', 'service', 'PENDING', 'CORADV',
   'Lawmind: Your appointment with Adv {1} is on {2} at {3}. - Corelearn IT',
   '[{"key":"advocate_name","label":"Advocate Name"},{"key":"date","label":"Date"},{"key":"time","label":"Time"}]'::jsonb,
   'appointment_scheduled', false, 120)

ON CONFLICT (template_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
