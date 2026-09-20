
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ratings_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- timestamp trigger function (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- MEETUPS
-- =========================
CREATE TABLE public.meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meetup_status_valid CHECK (status IN ('pending','confirmed','completed','cancelled')),
  CONSTRAINT meetup_distinct_parties CHECK (host_id <> guest_id)
);

CREATE INDEX idx_meetups_host ON public.meetups(host_id);
CREATE INDEX idx_meetups_guest ON public.meetups(guest_id);

ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their meetups"
  ON public.meetups FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR guest_id = auth.uid());

CREATE POLICY "Authenticated can create meetups they participate in"
  ON public.meetups FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid() OR guest_id = auth.uid());

CREATE POLICY "Participants can update their meetups"
  ON public.meetups FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR guest_id = auth.uid());

CREATE TRIGGER meetups_updated_at
  BEFORE UPDATE ON public.meetups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ELIGIBILITY HELPER
-- =========================
CREATE OR REPLACE FUNCTION public.can_rate(_rater UUID, _ratee UUID, _meetup_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _rater = _ratee THEN
    RETURN false;
  END IF;

  -- Path 1: completed meetup linking the two
  IF _meetup_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.meetups m
      WHERE m.id = _meetup_id
        AND m.status = 'completed'
        AND ((m.host_id = _rater AND m.guest_id = _ratee)
          OR (m.guest_id = _rater AND m.host_id = _ratee))
    );
  END IF;

  -- Path 2: any completed meetup between the two parties
  IF EXISTS (
    SELECT 1 FROM public.meetups m
    WHERE m.status = 'completed'
      AND ((m.host_id = _rater AND m.guest_id = _ratee)
        OR (m.guest_id = _rater AND m.host_id = _ratee))
  ) THEN
    RETURN true;
  END IF;

  -- Path 3: rater has an active subscription to ratee
  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.subscriber_id = _rater
      AND s.creator_id = _ratee
      AND s.status = 'active'
  ) THEN
    RETURN true;
  END IF;

  -- Path 4: rater has unlocked paid content from ratee (via payments table)
  IF EXISTS (
    SELECT 1
    FROM public.content_unlocks cu
    JOIN public.payments p ON p.id = cu.payment_id
    WHERE cu.user_id = _rater
      AND p.user_id = _rater
      AND p.status = 'paid'
      AND p.content_id LIKE _ratee::text || '%'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- =========================
-- RATINGS
-- =========================
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meetup_id UUID REFERENCES public.meetups(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL DEFAULT 'user',
  stars SMALLINT NOT NULL,
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ratings_stars_range CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT ratings_target_valid CHECK (target_type IN ('user','meetup')),
  CONSTRAINT ratings_review_length CHECK (review IS NULL OR char_length(review) <= 1000),
  CONSTRAINT ratings_self CHECK (rater_id <> ratee_id),
  CONSTRAINT ratings_unique_per_target UNIQUE (rater_id, ratee_id, meetup_id)
);

CREATE INDEX idx_ratings_ratee ON public.ratings(ratee_id);
CREATE INDEX idx_ratings_rater ON public.ratings(rater_id);
CREATE INDEX idx_ratings_meetup ON public.ratings(meetup_id);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ratings"
  ON public.ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Eligible users can insert their own ratings"
  ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND public.can_rate(auth.uid(), ratee_id, meetup_id)
  );

CREATE POLICY "Users can update their own ratings"
  ON public.ratings FOR UPDATE TO authenticated
  USING (rater_id = auth.uid());

CREATE POLICY "Users can delete their own ratings"
  ON public.ratings FOR DELETE TO authenticated
  USING (rater_id = auth.uid());

CREATE TRIGGER ratings_updated_at
  BEFORE UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- AVERAGE RATING MAINTENANCE
-- =========================
CREATE OR REPLACE FUNCTION public.recalc_profile_rating(_user UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC(3,2);
  v_count INTEGER;
BEGIN
  SELECT
    COALESCE(ROUND(AVG(stars)::numeric, 2), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM public.ratings
  WHERE ratee_id = _user;

  UPDATE public.profiles
  SET average_rating = v_avg,
      ratings_count = v_count,
      updated_at = now()
  WHERE user_id = _user;
END;
$$;

CREATE OR REPLACE FUNCTION public.ratings_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_profile_rating(OLD.ratee_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_profile_rating(NEW.ratee_id);
    IF TG_OP = 'UPDATE' AND OLD.ratee_id <> NEW.ratee_id THEN
      PERFORM public.recalc_profile_rating(OLD.ratee_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER ratings_aggregate
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.ratings_after_change();
