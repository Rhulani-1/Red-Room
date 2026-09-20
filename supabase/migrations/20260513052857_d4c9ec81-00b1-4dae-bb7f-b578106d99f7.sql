CREATE TABLE public.payfast_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  m_payment_id TEXT,
  payfast_payment_id TEXT,
  payment_status TEXT,
  content_id TEXT,
  amount_gross NUMERIC,
  raw_body TEXT NOT NULL,
  signature_ok BOOLEAN NOT NULL DEFAULT false,
  ip_ok BOOLEAN NOT NULL DEFAULT false,
  server_ok BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  source_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pfwe_created ON public.payfast_webhook_events (created_at DESC);
CREATE INDEX idx_pfwe_mpayment ON public.payfast_webhook_events (m_payment_id);
CREATE INDEX idx_pfwe_content ON public.payfast_webhook_events (content_id);

ALTER TABLE public.payfast_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
ON public.payfast_webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service inserts webhook events"
ON public.payfast_webhook_events
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service updates webhook events"
ON public.payfast_webhook_events
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);