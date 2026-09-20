-- Wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet"
ON public.wallets FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service can insert wallets"
ON public.wallets FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service can update wallets"
ON public.wallets FOR UPDATE TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wallet transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','payment','payout','refund','transfer')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  reference TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet transactions"
ON public.wallet_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service inserts wallet transactions"
ON public.wallet_transactions FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service updates wallet transactions"
ON public.wallet_transactions FOR UPDATE TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_wallet_tx_user_created ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_tx_wallet ON public.wallet_transactions(wallet_id);

CREATE TRIGGER update_wallet_tx_updated_at
BEFORE UPDATE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: keep wallet balance in sync with completed transactions
CREATE OR REPLACE FUNCTION public.apply_wallet_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    UPDATE public.wallets
    SET balance = balance + NEW.amount,
        updated_at = now()
    WHERE id = NEW.wallet_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- transitioning to completed
    IF (OLD.status IS DISTINCT FROM 'completed') AND NEW.status = 'completed' THEN
      UPDATE public.wallets
      SET balance = balance + NEW.amount,
          updated_at = now()
      WHERE id = NEW.wallet_id;
    -- reversing a previously completed transaction
    ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      UPDATE public.wallets
      SET balance = balance - OLD.amount,
          updated_at = now()
      WHERE id = OLD.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_tx_apply_balance
AFTER INSERT OR UPDATE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_transaction();

-- Auto-create a wallet for every new user (extend existing handle_new_user trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    split_part(NEW.email, '@', 1)
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill wallets for existing users (profiles)
INSERT INTO public.wallets (user_id)
SELECT user_id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;