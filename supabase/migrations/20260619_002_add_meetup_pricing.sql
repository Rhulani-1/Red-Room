-- Add pricing fields to meetups for paid hangouts
ALTER TABLE public.meetups 
ADD COLUMN price_rands decimal(10,2),
ADD COLUMN currency text DEFAULT 'ZAR' CHECK (currency IN ('ZAR', 'USD')),
ADD COLUMN payment_method text CHECK (payment_method IN ('payfast', 'stripe', 'bank_transfer'));

-- Index for sorting by price
CREATE INDEX idx_meetups_price_rands ON public.meetups(price_rands) WHERE price_rands IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.meetups.price_rands IS 'Price in rand (ZAR) or USD. NULL = free hangout';
COMMENT ON COLUMN public.meetups.currency IS 'Currency for pricing: ZAR (default) or USD';
COMMENT ON COLUMN public.meetups.payment_method IS 'Payment processor: payfast, stripe, or bank_transfer';
