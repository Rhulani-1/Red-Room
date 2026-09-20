
CREATE TABLE public.post_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  duration_hours INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payment_method TEXT NOT NULL,
  payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_boosts_post ON public.post_boosts(post_id);
CREATE INDEX idx_post_boosts_user ON public.post_boosts(user_id);
CREATE INDEX idx_post_boosts_active ON public.post_boosts(status, expires_at);

ALTER TABLE public.post_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view boosts"
  ON public.post_boosts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert own boosts"
  ON public.post_boosts FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own boosts"
  ON public.post_boosts FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_post_boosts_updated_at
  BEFORE UPDATE ON public.post_boosts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
