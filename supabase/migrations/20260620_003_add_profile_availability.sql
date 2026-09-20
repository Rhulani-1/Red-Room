-- Add availability field to profiles for NearMe display
ALTER TABLE public.profiles 
ADD COLUMN availability text DEFAULT 'public' CHECK (availability IN ('public', 'private', 'friends_only'));

-- Index for filtering by availability
CREATE INDEX idx_profiles_availability ON public.profiles(availability) WHERE availability != 'private';

-- Comment for clarity
COMMENT ON COLUMN public.profiles.availability IS 'User availability: public (everyone can see), private (hidden), or friends_only (friends can see)';
