-- Payment proof (cheque / UPI screenshot) uploaded to R2 from the Payments tab.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;

NOTIFY pgrst, 'reload schema';
