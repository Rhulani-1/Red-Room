-- 2026-06-14 Create payment_logs table and RLS
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id text,
  amount numeric(10,2),
  status text NOT NULL CHECK (status IN ('initiated', 'pending', 'complete', 'failed', 'cancelled')),
  provider text DEFAULT 'payfast',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own logs; admins see all
DROP POLICY IF EXISTS "users_read_own_payment_logs" ON public.payment_logs;
CREATE POLICY "users_read_own_payment_logs" ON public.payment_logs
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::public.app_role));

-- Only service role can insert (via edge functions)
DROP POLICY IF EXISTS "service_role_insert_payment_logs" ON public.payment_logs;
CREATE POLICY "service_role_insert_payment_logs" ON public.payment_logs
  FOR INSERT WITH CHECK (false);
