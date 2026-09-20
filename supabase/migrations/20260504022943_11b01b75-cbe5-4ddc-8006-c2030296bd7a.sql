
CREATE TABLE public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  gross_amount NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service inserts platform revenue"
ON public.platform_revenue FOR INSERT
TO service_role WITH CHECK (true);

CREATE POLICY "Service reads platform revenue"
ON public.platform_revenue FOR SELECT
TO service_role USING (true);

CREATE INDEX idx_platform_revenue_creator ON public.platform_revenue(creator_id);
CREATE INDEX idx_platform_revenue_created_at ON public.platform_revenue(created_at DESC);
