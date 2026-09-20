CREATE TABLE public.agreement_payment_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id TEXT NOT NULL UNIQUE,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agreement_payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view confirmations"
ON public.agreement_payment_confirmations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert own confirmation"
ON public.agreement_payment_confirmations
FOR INSERT
TO authenticated
WITH CHECK (confirmed_by = auth.uid());