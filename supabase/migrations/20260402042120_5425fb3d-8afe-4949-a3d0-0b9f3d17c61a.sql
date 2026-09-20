
-- Payments table to track all PayFast transactions
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_type TEXT NOT NULL DEFAULT 'once_off',
  payfast_payment_id TEXT,
  payfast_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content unlocks to track which users have unlocked which content
CREATE TABLE public.content_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_id TEXT NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  unlock_type TEXT NOT NULL DEFAULT 'purchase',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Subscriptions table for monthly creator subscriptions
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payfast_token TEXT,
  amount DECIMAL(10,2) NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + INTERVAL '30 days',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, creator_id)
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Payments: users can view their own payments
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Content unlocks: users can view their own unlocks
CREATE POLICY "Users can view own unlocks" ON public.content_unlocks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Subscriptions: users can view subscriptions they're part of
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (subscriber_id = auth.uid() OR creator_id = auth.uid());

-- Allow service role to insert (edge functions use service role)
CREATE POLICY "Service can insert payments" ON public.payments
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service can update payments" ON public.payments
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service can insert unlocks" ON public.content_unlocks
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service can insert subscriptions" ON public.subscriptions
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service can update subscriptions" ON public.subscriptions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
