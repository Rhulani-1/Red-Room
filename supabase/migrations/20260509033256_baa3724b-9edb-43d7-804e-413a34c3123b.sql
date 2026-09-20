-- Notification preferences table
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY,
  notif_likes BOOLEAN NOT NULL DEFAULT true,
  notif_comments BOOLEAN NOT NULL DEFAULT true,
  notif_follows BOOLEAN NOT NULL DEFAULT true,
  notif_messages BOOLEAN NOT NULL DEFAULT true,
  notif_live BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification prefs"
ON public.notification_preferences FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own notification prefs"
ON public.notification_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own notification prefs"
ON public.notification_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create prefs row when a new user signs up (extend existing handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Helper: check if a user wants a given notification type
CREATE OR REPLACE FUNCTION public.should_notify(_user_id UUID, _type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefs public.notification_preferences%ROWTYPE;
BEGIN
  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN true; -- default on if no row
  END IF;
  RETURN CASE _type
    WHEN 'like' THEN v_prefs.notif_likes
    WHEN 'comment' THEN v_prefs.notif_comments
    WHEN 'follow' THEN v_prefs.notif_follows
    WHEN 'message' THEN v_prefs.notif_messages
    WHEN 'live' THEN v_prefs.notif_live
    ELSE true
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.should_notify(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.should_notify(UUID, TEXT) TO authenticated;

-- Backfill prefs for existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;